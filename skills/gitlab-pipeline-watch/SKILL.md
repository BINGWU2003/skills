---
name: gitlab-pipeline-watch
description: Watch GitLab MR pipelines and react to state changes
---

# MR Watch Skill

Block until a GitLab MR pipeline reaches an actionable state (success, failure, merge, or new MR created), then react. Designed for event-loop workflows where you need to wait for CI results before taking action.

## Prerequisites

- `glab` CLI installed and authenticated (`glab auth status`)
- Python 3.7+

Since the script has a `#!/usr/bin/env python3` shebang, you can also run it directly as `./scripts/pipeline-watch.py` if it has execute permission.

## Available Scripts

- **`scripts/pipeline-watch.py`** -- Polls GitLab MR pipelines and exits when an actionable event occurs

## Quick Start

```bash
# Watch all open MRs in a project (recommended default)
python3 scripts/pipeline-watch.py gitlab-org/gitlab

# Watch specific MRs only
python3 scripts/pipeline-watch.py gitlab-org/gitlab --no-all --no-watch-new 458 459

# Wait for new pushes (ignore stale/failed pipelines)
python3 scripts/pipeline-watch.py gitlab-org/gitlab --wait-for-push
```

## Event-Loop Workflow

The core pattern is: **watch -> react -> repeat**. The script blocks until something actionable happens, then exits so you can handle it.

### 1. Start Watching

```bash
python3 scripts/pipeline-watch.py <project>
```

This watches all open (non-draft) MRs in the project, detects new MRs, and exits on the first actionable event.

### 2. Parse the Output

The script prints status lines as events occur and a summary on exit:

```
Watching 3 MRs in gitlab-org/gitlab (poll every 20s, timeout 1800s)
Also watching for new MRs on the project

RUNNING !458 [pipeline:running] feat: add search filter
SUCCESS !459 [pipeline:success] fix: resolve timeout
PENDING !460 [pipeline:pending] refactor: extract service
(initial state -- waiting for transitions)

SUCCESS !458 [pipeline:success] feat: add search filter

Exiting: pipeline succeeded
  -> SUCCESS !458 [pipeline:success] feat: add search filter

--- Summary ---
  !458  pipeline=success  merge=mergeable
  !459  pipeline=success  merge=mergeable
  !460  pipeline=running  merge=ci_must_pass
```

**Event prefixes** (machine-parseable, one per line):
- `SUCCESS` -- pipeline finished green
- `FAILED` -- pipeline finished red
- `CANCELED` -- pipeline was canceled
- `SKIPPED` -- pipeline was skipped or requires manual action
- `MERGED` -- MR was merged
- `NEW` -- new MR appeared on the project
- `RUNNING` -- pipeline started/restarted
- `PENDING` -- pipeline queued
- `CONFLICT` -- MR has merge conflicts
- `WAITING` -- ignoring stale pipeline (`--wait-for-push` mode)
- `UNKNOWN` -- unexpected pipeline state

### 3. React to the Event

Based on what happened, take the appropriate action:

| Event | Typical reaction |
|-------|-----------------|
| `SUCCESS` | Review the MR, merge if approved, or dispatch next task |
| `FAILED` | Investigate failures (load `gitlab-pipeline-investigate` skill), fix or send feedback |
| `CANCELED` | Check why, retry pipeline if appropriate |
| `SKIPPED` | Check pipeline config, trigger manual job if needed |
| `MERGED` | Update tracking, dispatch dependent tasks |
| `NEW` | Review the new MR, assign reviewers |
| `CONFLICT` | Rebase the branch or notify the author |
| Timeout | Check if something is stuck, re-run with longer `--timeout` |

### 4. Repeat

After handling the event, run `pipeline-watch.py` again to wait for the next one:

```bash
# Continue watching the same project
python3 scripts/pipeline-watch.py <project>

# Or narrow down after handling some MRs
python3 scripts/pipeline-watch.py <project> --no-all --no-watch-new 460
```

## Script Options

```
python3 scripts/pipeline-watch.py <project> [mr1] [mr2] ...

Options:
  --all / --no-all           Watch all open non-draft MRs (default: --all)
  --include-drafts           Include draft/WIP MRs when using --all
  --watch-new / --no-watch-new  Detect new MRs on the project (default: --watch-new)
  --wait-for-push            Ignore stale pipelines, wait for new pushes
  --interval N               Poll interval in seconds (default: 20)
  --timeout N                Exit after N seconds with no event (default: 1800)
  --debug                    Print baseline IDs, state transitions, skip reasons
```

## Common Patterns

### Watch all MRs (simplest)

```bash
python3 scripts/pipeline-watch.py gitlab-org/gitlab
```

Watches all open non-draft MRs, auto-discovers new ones, exits on first actionable event. This is the recommended default -- just point it at a project and react to whatever comes back.

### Watch specific MRs only

```bash
python3 scripts/pipeline-watch.py gitlab-org/gitlab --no-all --no-watch-new 458 459
```

Only monitors the listed MRs. Use when you know exactly which MRs you care about and don't want noise from others.

### Wait for pushes after dispatching work

```bash
python3 scripts/pipeline-watch.py gitlab-org/gitlab --wait-for-push
```

Ignores current stale/failed pipelines and waits for new ones. Use when you've dispatched work and expect new commits to be pushed -- you don't want to exit immediately because of an old failure.

### Short timeout for quick checks

```bash
python3 scripts/pipeline-watch.py gitlab-org/gitlab --timeout 300 --interval 10
```

Faster polling with a 5-minute timeout. Use for pipelines you expect to finish soon.

## How It Works

1. **Initial poll**: Snapshots current state of all watched MRs
2. **Transition detection**: Only exits on *state transitions* (e.g., running -> success), not on already-terminal states
3. **Early exit**: If all MRs are already in a terminal state on first poll, exits immediately (unless `--wait-for-push`)
4. **New MR detection**: Compares current open MRs against the initial snapshot to detect newly created ones
5. **Stale pipeline handling** (`--wait-for-push`): Records baseline pipeline IDs and ignores them until a new pipeline ID appears

## Agent Guidelines

1. **Default to watching all MRs** -- `python3 scripts/pipeline-watch.py <project>` is the simplest and most useful invocation
2. **Use `--wait-for-push` after dispatching work** -- avoids false exits from old pipeline results
3. **Parse event prefixes** -- lines starting with `SUCCESS`, `FAILED`, `MERGED`, `NEW` indicate the actionable event type
4. **Check the summary** -- the `--- Summary ---` section shows the final state of all watched MRs
5. **Set appropriate timeouts** -- default 30min is good for CI pipelines; use shorter for quick jobs
6. **Run in a loop** -- this script is designed to be called repeatedly, handling one event at a time
7. **Combine with other skills** -- on `FAILED`, load `gitlab-pipeline-investigate` to analyze failures; on `SUCCESS`, proceed with review or merge
8. **Don't over-poll** -- the default 20s interval is reasonable; going below 10s risks API rate limits
