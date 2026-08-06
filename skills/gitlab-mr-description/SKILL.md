---
name: gitlab-mr-description
description: Write or update a GitLab MR description. Reads the branch diff, drafts structured markdown using GitLab's standard sections, and applies conventions for feature flags, database queries, and local testing matrices. Use when opening a new MR or refreshing an existing description.
---

# GitLab MR Description

When invoked, read the branch diff, infer the change's intent and shape, then produce a complete MR description. Fill every section you have evidence for; omit sections that genuinely don't apply. Never leave placeholder text in the final output.

## Step 1 — Gather context

```bash
BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null || echo "origin/$(git remote show origin | awk '/HEAD branch/ {print $NF}')")
git diff "$BASE"..HEAD --stat
git log --oneline "$BASE"..HEAD
git diff "$BASE"..HEAD
glab mr view <number>   # read existing description if one exists
ls .gitlab/merge_request_templates/ 2>/dev/null
cat .gitlab/merge_request_templates/Default.md 2>/dev/null
```

Answer: *What does this MR add or fix? Why? What surfaces does it touch? Does the project have a default MR template?*

## Step 2 — Write the description

- **Base structure**: project default MR template if present; otherwise [references/TEMPLATE.md](references/TEMPLATE.md).
- **Fill sections**: use [references/TEMPLATE.md](references/TEMPLATE.md) as the population guide for every heading in the base.
- **Fill gaps**: if the diff touches a surface the base template has no heading for, add that section from [references/TEMPLATE.md](references/TEMPLATE.md).
- Fill only sections you have evidence for; omit the rest; no placeholder text.

## References

- **Full section template**: [references/TEMPLATE.md](references/TEMPLATE.md)
- **Per-section writing rules and what to omit**: [references/SECTION_RULES.md](references/SECTION_RULES.md)
