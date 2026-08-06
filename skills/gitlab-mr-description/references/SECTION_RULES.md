# Section-by-Section Rules

## Summary

- One sentence. Imperative ("Adds …", not "This MR adds …").
- Include the parent issue number as `#NNN` only in the prose — use a full URL when linking anywhere that renders outside GitLab (related section, commit body).
- If the MR is gated behind a WIP feature flag, say so explicitly and note it is **off by default in production**.

## Approach

- Explain the *why*, not just the *what* — the diff already shows what changed.
- If the implementation made a non-obvious choice (e.g. reusing an existing table instead of adding one, a specific enum value ordering, a performance trade-off), explain it here so reviewers don't re-raise the same alternatives.
- Keep paragraphs to 3–5 sentences. Use subsections only when the change spans multiple distinct concerns.

## Database

Only include this section if the MR adds or changes queries. When you do:

- Write SQL in subquery form so it can be pasted into postgres.ai without real IDs. Add a one-liner noting that Rails emits flat `IN (id1, id2, …)` at runtime — this prevents the reviewer from thinking the runtime does something more expensive.
- Verify index names against the actual schema (`pg_indexes`) — never write them from memory.
- If alternatives were tested, document them with postgres.ai plan links and concrete numbers. Reviewers reliably re-suggest alternatives that weren't documented as already tried.

## Feature flag

- WIP flags are **off by default in production** and **on by default in the test environment**. Both facts should be visible somewhere in the description.
- The local testing matrix must cover the disabled state explicitly, because the disabled path is the production default before rollout.

## Local testing matrix conventions

- Vary **only the flags this MR introduces**. Pre-existing flags are prerequisites, not matrix axes.
- Always include the disabled-FF row — that is the production default.
- Label the disabled-state context `'when the feature flag is disabled'`, not a compound description like `'when the flag is disabled and no data is present'` — the data state is irrelevant when the gate is closed.

## Related

- Use full URLs everywhere: `https://gitlab.com/gitlab-org/gitlab/-/merge_requests/NNN`. Short refs (`!NNN`) render as plain text outside GitLab and can trip the commit-message linter.

## What to skip

Omit a section entirely (don't leave it empty or with placeholder text) when:

- **Database** — the MR adds no queries and changes no schema.
- **Feature flag** — no FF is introduced or changed.
- **Preloading** — the change touches no association loading path.
- **Field / response shape** — the change is not a data-shape change visible to callers.

A shorter, accurate description is better than a long one with empty tables.
