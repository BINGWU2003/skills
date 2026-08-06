# MR Description Template

Use this skeleton. Wrap long sections in `<details><summary>` so reviewers can skip them.

```markdown
## Summary

Part of #<issue>. Split from !<parent-mr-url> (if applicable).

<One sentence: what the MR adds or fixes, and why.>

<Optional: table of surfaces touched.>

<If gated: Gated behind the `<flag_name>` WIP feature flag (off by default in production).>

## Approach

### <Business logic / Detection / Core change>

<Short prose on what the code does and why it's structured that way. Explain
non-obvious decisions. Reference rejected alternatives if they came up during
implementation.>

### <Field / response shape> (omit if not a data-shape change)

| Value | Meaning |
|-------|---------|
| `true` | … |
| `false` | … |
| `null` | … |

### Preloading (omit if no N+1 risk)

<Show the preload tree. One line per association, explaining what each avoids.>

### Feature flag gating (omit if no FF)

<Per-surface table: method name, what it checks, what it returns when the FF is disabled.>

## Database (omit if no queries added or changed)

<details>
<summary>Queries and query plans</summary>

For each new or changed query:

- SQL in subquery form (safe to paste into postgres.ai without needing real IDs).
- Note if Rails emits a flat `IN (id1, id2, …)` at runtime rather than the
  subquery form shown above.
- The **exact** index name backing the query (verify with `pg_indexes` — do not
  guess from memory).
- Link to the postgres.ai query plan.

</details>

<details>
<summary>Considered and rejected alternatives</summary>

For each alternative tried and rejected:

- The query or code form attempted.
- Link to the postgres.ai plan with concrete numbers (loop count, buffer hits, ms).
- One-line conclusion: why it lost.
- Follow-up path if rollout data later changes the calculus.

</details>

## Feature flag (omit if no FF introduced)

| Flag | Type | Scope | Default | Purpose |
|------|------|-------|---------|---------|
| `<flag_name>` | `wip` | … | off | … |

## Local testing

<details>
<summary>Setup and verification</summary>

1. <How to get test data: import project / seed via console / run factory>
2. <Enable required feature flags. WIP flags are **off by default** — call them out explicitly.>

**Value matrix** — walk every combination of flag state × data state:

| Data present | `<flag_name>` enabled | Expected result |
|---|---|---|
| yes | yes | … |
| yes | no | … |
| no | yes | … |

</details>

## Related

- <Companion MRs with full URLs>
- <Parent or split-from MR with full URL>
- <Issue / epic with full URL>
```
