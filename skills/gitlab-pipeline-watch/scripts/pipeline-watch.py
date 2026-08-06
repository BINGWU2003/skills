#!/usr/bin/env python3
"""Watch GitLab MR pipelines and exit when any reaches an actionable state.

Usage:
    python3 scripts/pipeline-watch.py <project> [mr1] [mr2] ...
    python3 scripts/pipeline-watch.py <project>
    python3 scripts/pipeline-watch.py gitlab-org/gitlab 263 264 265
    python3 scripts/pipeline-watch.py gitlab-org/gitlab --no-all --no-watch-new 458

Exits when any MR pipeline transitions to success/failed, an MR is merged,
or a new MR is created on the project.

Exit codes:
    0   Actionable event detected (pipeline finished, MR merged, new MR, conflict, timeout)

Requires: glab CLI (https://gitlab.com/gitlab-org/cli) authenticated with GitLab.
"""

import argparse
import json
import subprocess
import sys
import time
import urllib.parse


TERMINAL_PIPELINE_STATES = {"success", "failed", "canceled", "skipped", "manual"}


def positive_int(value):
    """Argparse type that requires a positive integer."""
    ivalue = int(value)
    if ivalue <= 0:
        raise argparse.ArgumentTypeError(f"{value} is not a positive integer")
    return ivalue


def non_negative_int(value):
    """Argparse type that requires a non-negative integer."""
    ivalue = int(value)
    if ivalue < 0:
        raise argparse.ArgumentTypeError(f"{value} is not a non-negative integer")
    return ivalue


def glab_api(path, debug=False):
    try:
        result = subprocess.run(
            ["glab", "api", path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
        if debug:
            stderr = result.stderr.strip()
            print(
                f"  [debug] glab_api({path}): exit {result.returncode}"
                + (f": {stderr}" if stderr else ""),
                file=sys.stderr,
            )
    except json.JSONDecodeError as e:
        if debug:
            print(
                f"  [debug] glab_api({path}): JSON decode error: {e}", file=sys.stderr
            )
    except subprocess.TimeoutExpired:
        if debug:
            print(f"  [debug] glab_api({path}): timed out after 30s", file=sys.stderr)
    return None


def parse_args():
    parser = argparse.ArgumentParser(
        description="Watch GitLab MR pipelines and exit on actionable state changes.\n\n"
        "Default: watches all open MRs, detects new MRs.\n"
        "Just run: python3 scripts/pipeline-watch.py <project>",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("project", help="GitLab project path (e.g. gitlab-org/gitlab)")
    parser.add_argument(
        "mrs", nargs="*", type=int, help="MR iids to watch (in addition to --all)"
    )
    parser.add_argument(
        "--interval",
        type=positive_int,
        default=20,
        help="poll interval in seconds (default: 20)",
    )
    parser.add_argument(
        "--timeout",
        type=non_negative_int,
        default=1800,
        help="exit after N seconds with no actionable event (default: 1800); 0 means no timeout",
    )
    # --all defaults to True; use --no-all to disable.
    # (Defining only --no-all avoids the misleading store_true + default=True pattern
    # where passing --all explicitly would be a no-op.)
    parser.set_defaults(all=True, watch_new=True)
    parser.add_argument(
        "--no-all",
        dest="all",
        action="store_false",
        help="only watch explicitly listed MRs (default: watch all open MRs)",
    )
    parser.add_argument(
        "--no-watch-new",
        dest="watch_new",
        action="store_false",
        help="don't watch for new MRs (default: watch for new MRs)",
    )
    parser.add_argument(
        "--wait-for-push",
        dest="wait_for_push",
        action="store_true",
        default=False,
        help="ignore stale pipelines, wait for new pushes",
    )
    parser.add_argument(
        "--no-wait-for-push",
        dest="wait_for_push",
        action="store_false",
        help="exit immediately if any watched MR has a terminal pipeline (default)",
    )
    parser.add_argument(
        "--include-drafts",
        dest="include_drafts",
        action="store_true",
        default=False,
        help="include draft/WIP MRs when using --all (default: exclude drafts)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        default=False,
        help="print debug info (baseline IDs, state transitions, skip reasons)",
    )
    return parser.parse_args()


def format_mr_line(mr, prev_states):
    """Format a single MR status line."""
    state = prev_states.get(mr, "none|unknown|unknown")
    parts = state.split("|")
    pipeline = parts[0]
    merge_status = parts[1] if len(parts) > 1 else "unknown"
    mr_state = parts[2] if len(parts) > 2 else "unknown"
    if mr_state == "merged":
        return f"  !{mr}  merged"
    elif merge_status == "conflict":
        return f"  !{mr}  pipeline={pipeline}  merge=conflict"
    else:
        return f"  !{mr}  pipeline={pipeline}  merge={merge_status}"


def print_summary_and_exit(mr_iids, prev_states, reason=None, triggers=None):
    """Print final summary table and exit.

    Args:
        triggers: list of specific MR/event strings that caused the exit
    """
    print()
    if reason:
        print(f"Exiting: {reason}")
    if triggers:
        for t in triggers:
            print(f"  -> {t}")
    print()
    print("--- Summary ---")
    for mr in sorted(mr_iids, key=int):
        print(format_mr_line(mr, prev_states))
    sys.exit(0)


def debug_log(msg, enabled):
    if enabled:
        print(f"  [debug] {msg}", file=sys.stderr)


def main():
    args = parse_args()
    project = args.project
    mr_iids = {str(iid) for iid in args.mrs}
    dbg = args.debug
    interval = args.interval
    watch_new = args.watch_new
    timeout = args.timeout
    project_encoded = urllib.parse.quote(project, safe="")

    # --all: fetch all open MRs and add them to the watch set
    include_drafts = args.include_drafts
    if args.all:
        mrs_data = glab_api(
            f"projects/{project_encoded}/merge_requests"
            f"?state=opened&per_page=100&order_by=created_at&sort=desc",
            debug=dbg,
        )
        if mrs_data:
            for mr_data in mrs_data:
                iid = str(mr_data.get("iid", ""))
                wip = mr_data.get("work_in_progress", False)
                draft = mr_data.get("draft", False)
                if iid and (include_drafts or (not wip and not draft)):
                    mr_iids.add(iid)
    start_time = time.time()

    prev_states = {}  # mr_iid -> "pipeline|merge_status|mr_state"
    prev_pipelines = {}  # mr_iid -> last pipeline status (transition detection)
    prev_mr_states = {}  # mr_iid -> last MR state (merge detection)
    known_mr_iids = set(mr_iids)
    first_poll = True
    wait_for_push = args.wait_for_push
    baseline_pipeline_ids = {}  # mr_iid -> pipeline ID to ignore (--wait-for-push)

    # Snapshot existing open MRs so they aren't flagged as "new"
    if watch_new:
        mrs_data = glab_api(
            f"projects/{project_encoded}/merge_requests"
            f"?state=opened&per_page=100&order_by=created_at&sort=desc",
            debug=dbg,
        )
        if mrs_data:
            for mr_data in mrs_data:
                iid = str(mr_data.get("iid", ""))
                if iid:
                    known_mr_iids.add(iid)

    # Guard: nothing to watch
    if not mr_iids and not watch_new:
        print(
            f"Error: no MRs to watch in {project}. "
            "Either the project was not found, has no open MRs, or no MR iids were specified.",
            file=sys.stderr,
        )
        sys.exit(1)

    timeout_display = f"{timeout}s" if timeout > 0 else "none"
    print(
        f"Watching {len(mr_iids)} MRs in {project} (poll every {interval}s, timeout {timeout_display})"
    )
    if watch_new:
        print("Also watching for new MRs on the project")
    if wait_for_push:
        print("Waiting for new pipelines (ignoring current state)")
    print()

    while True:
        changed = False
        events = []

        # Check for new MRs on the project
        if watch_new:
            mrs_data = glab_api(
                f"projects/{project_encoded}/merge_requests"
                f"?state=opened&per_page=20&order_by=created_at&sort=desc",
                debug=dbg,
            )
            if mrs_data:
                for mr_data in mrs_data:
                    iid = str(mr_data.get("iid", ""))
                    wip = mr_data.get("work_in_progress", False)
                    draft = mr_data.get("draft", False)
                    if iid and iid not in known_mr_iids:
                        known_mr_iids.add(iid)
                        if not include_drafts and (wip or draft):
                            continue
                        mr_iids.add(iid)
                        title = mr_data.get("title", "unknown")
                        tb = mr_data.get("target_branch", "main")
                        bh = f" -> {tb}" if tb not in ("main", "master") else ""
                        events.append(f"NEW !{iid} [created]{bh} {title}")
                        changed = True

        # Check each tracked MR
        for mr in sorted(mr_iids, key=int):
            data = glab_api(
                f"projects/{project_encoded}/merge_requests/{mr}", debug=dbg
            )
            if not data:
                continue

            title = data.get("title", "unknown")
            target_branch = data.get("target_branch", "main")
            hp = data.get("head_pipeline") or {}
            pipeline = hp.get("status", "none")
            pipeline_id = hp.get("id")
            merge_status = data.get(
                "detailed_merge_status", data.get("merge_status", "unknown")
            )
            conflicts = data.get("has_conflicts", False)
            mr_state = data.get("state", "unknown")
            # Show target branch if not default
            branch_hint = (
                f" -> {target_branch}"
                if target_branch not in ("main", "master")
                else ""
            )

            # --wait-for-push: ignore pipeline state until we see a new pipeline ID
            if wait_for_push and mr in baseline_pipeline_ids:
                if pipeline_id == baseline_pipeline_ids[mr]:
                    # Same old pipeline -- treat as "waiting"
                    pipeline = "waiting_for_push"
                    debug_log(f"!{mr}: ignoring pipeline {pipeline_id} (baseline)", dbg)
                else:
                    debug_log(
                        f"!{mr}: new pipeline {pipeline_id} (was {baseline_pipeline_ids[mr]}) -- tracking",
                        dbg,
                    )

            current = f"{pipeline}|{merge_status}|{mr_state}"
            prev = prev_states.get(mr)

            if current != prev:
                changed = True
                prev_states[mr] = current

                if mr_state == "merged":
                    events.append(f"MERGED !{mr} [merged] {title}")
                elif pipeline == "waiting_for_push":
                    events.append(
                        f"WAITING !{mr} [waiting for push]{branch_hint} {title}"
                    )
                elif conflicts:
                    events.append(f"CONFLICT !{mr} [conflicts]{branch_hint} {title}")
                elif pipeline == "success":
                    events.append(
                        f"SUCCESS !{mr} [pipeline:success]{branch_hint} {title}"
                    )
                elif pipeline == "failed":
                    events.append(
                        f"FAILED !{mr} [pipeline:failed]{branch_hint} {title}"
                    )
                elif pipeline == "canceled":
                    events.append(
                        f"CANCELED !{mr} [pipeline:canceled]{branch_hint} {title}"
                    )
                elif pipeline in ("skipped", "manual"):
                    events.append(
                        f"SKIPPED !{mr} [pipeline:{pipeline}]{branch_hint} {title}"
                    )
                elif pipeline == "running":
                    events.append(
                        f"RUNNING !{mr} [pipeline:running]{branch_hint} {title}"
                    )
                elif pipeline in ("pending", "created", "waiting_for_resource"):
                    events.append(
                        f"PENDING !{mr} [pipeline:{pipeline}]{branch_hint} {title}"
                    )
                else:
                    events.append(
                        f"UNKNOWN !{mr} [pipeline:{pipeline}]{branch_hint} {title}"
                    )

        # Print events
        for event in events:
            print(event)

        # First poll: record baseline. If any watched MR is already terminal
        # and we're not in --wait-for-push mode, exit immediately.
        if first_poll:
            first_poll = False

            # Record baseline pipeline IDs for --wait-for-push.
            # Any terminal pipeline at startup is considered stale -- the user
            # has dispatched work and expects new commits, so we wait for a
            # new pipeline ID before reporting results.
            if wait_for_push:
                for mr in mr_iids:
                    data = glab_api(
                        f"projects/{project_encoded}/merge_requests/{mr}",
                        debug=dbg,
                    )
                    if data:
                        hp = data.get("head_pipeline") or {}
                        pid = hp.get("id")
                        status = hp.get("status", "none")
                        if pid and status in TERMINAL_PIPELINE_STATES:
                            baseline_pipeline_ids[mr] = pid
                            debug_log(
                                f"!{mr}: stale pipeline {pid} ({status}) -- will ignore until new push",
                                dbg,
                            )
                        elif pid:
                            debug_log(
                                f"!{mr}: pipeline {pid} ({status}) -- tracking normally",
                                dbg,
                            )

            already_terminal = False
            for mr in mr_iids:
                state = prev_states.get(mr, "")
                parts = state.split("|")
                pipeline = parts[0] if parts else ""
                mr_state = parts[2] if len(parts) > 2 else ""
                prev_pipelines[mr] = pipeline
                prev_mr_states[mr] = mr_state
                if pipeline in TERMINAL_PIPELINE_STATES or mr_state == "merged":
                    already_terminal = True

            # Skip early exit only if --wait-for-push AND there are actually
            # stale pipelines to wait for. If all MRs are green+mergeable,
            # exit normally even with --wait-for-push.
            has_stale = bool(baseline_pipeline_ids)
            if already_terminal and not (wait_for_push and has_stale):
                debug_log(
                    "early exit: terminal MRs detected, no stale pipelines to wait for",
                    dbg,
                )
                terminal_details = []
                for mr in sorted(mr_iids, key=int):
                    pl = prev_pipelines.get(mr, "")
                    ms = prev_mr_states.get(mr, "")
                    if ms == "merged":
                        terminal_details.append(f"!{mr} already merged")
                    elif pl in TERMINAL_PIPELINE_STATES:
                        label = "succeeded" if pl == "success" else pl
                        terminal_details.append(f"!{mr} pipeline already {label}")
                print_summary_and_exit(
                    mr_iids,
                    prev_states,
                    "nothing to wait for -- all watched MRs in final state",
                    terminal_details,
                )

            if events:
                if wait_for_push:
                    print("(baseline recorded -- waiting for new pipelines)\n")
                else:
                    print("(initial state -- waiting for transitions)\n")
            time.sleep(interval)
            continue

        # Exit when a pipeline or MR state *transitions* to terminal,
        # or a new MR appears.
        if changed:
            actionable = False

            for mr in mr_iids:
                state = prev_states.get(mr, "")
                parts = state.split("|")
                pipeline = parts[0] if parts else ""
                mr_state = parts[2] if len(parts) > 2 else ""
                prev_pl = prev_pipelines.get(mr, "")
                prev_ms = prev_mr_states.get(mr, "")

                if (
                    pipeline in TERMINAL_PIPELINE_STATES
                    and prev_pl not in TERMINAL_PIPELINE_STATES
                ):
                    actionable = True
                if mr_state == "merged" and prev_ms != "merged":
                    actionable = True

            if any(e.startswith("NEW") for e in events):
                actionable = True
            if any(e.startswith("CONFLICT") for e in events):
                actionable = True

            # Update transition trackers
            for mr in mr_iids:
                state = prev_states.get(mr, "")
                parts = state.split("|")
                prev_pipelines[mr] = parts[0] if parts else ""
                prev_mr_states[mr] = parts[2] if len(parts) > 2 else ""

            # Build reason and trigger details
            if actionable:
                reasons = []
                triggers = []
                for e in events:
                    if e.startswith("NEW"):
                        reasons.append("new MR detected")
                        triggers.append(e.strip())
                    elif e.startswith("SUCCESS"):
                        reasons.append("pipeline succeeded")
                        triggers.append(e.strip())
                    elif e.startswith("FAILED"):
                        reasons.append("pipeline failed")
                        triggers.append(e.strip())
                    elif e.startswith("CANCELED"):
                        reasons.append("pipeline canceled")
                        triggers.append(e.strip())
                    elif e.startswith("SKIPPED"):
                        reasons.append("pipeline skipped")
                        triggers.append(e.strip())
                    elif e.startswith("MERGED"):
                        reasons.append("MR merged")
                        triggers.append(e.strip())
                    elif e.startswith("CONFLICT"):
                        reasons.append("merge conflict detected")
                        triggers.append(e.strip())
                reason = (
                    ", ".join(dict.fromkeys(reasons)) if reasons else "state changed"
                )
                print_summary_and_exit(mr_iids, prev_states, reason, triggers)

        if timeout > 0 and time.time() - start_time >= timeout:
            elapsed = int(time.time() - start_time)
            still_running = [
                f"!{mr}"
                for mr in sorted(mr_iids, key=int)
                if prev_pipelines.get(mr, "") not in TERMINAL_PIPELINE_STATES
                and prev_mr_states.get(mr, "") != "merged"
            ]
            hint = (
                f" -- still waiting on: {', '.join(still_running)}"
                if still_running
                else " -- all MRs in final state but no transitions detected"
            )
            print(f"\nTimeout after {elapsed}s{hint}")
            print_summary_and_exit(mr_iids, prev_states, "timeout")

        time.sleep(interval)


if __name__ == "__main__":
    main()
