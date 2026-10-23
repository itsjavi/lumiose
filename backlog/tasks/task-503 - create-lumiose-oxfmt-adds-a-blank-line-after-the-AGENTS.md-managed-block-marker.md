---
id: TASK-503
title: >-
  create-lumiose: oxfmt adds a blank line after the AGENTS.md managed-block
  marker
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 01:38'
updated_date: '2026-10-23 19:31'
labels: []
dependencies: []
priority: low
ordinal: 499000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while preparing the dotmatrix workspace (TASK-488): formatting the AGENTS.md that create-lumiose writes with oxfmt inserts a blank line after the managed-block marker, so a later create or update sees a changed block. Make the generated block oxfmt-stable (or have the updater tolerate the blank line).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 oxfmt leaves a freshly generated AGENTS.md unchanged, and updating the managed block after oxfmt works (test)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (0.6.1 cleanup): agentsSection() now has a blank line after the start marker and before the end marker, which is how oxfmt formats Markdown, so a formatted AGENTS.md matches the next run's section (no churn). Tests: packages/cli/src/agents/agents.test.ts checks that oxfmt leaves every generated Markdown file unchanged (with and without @lumiose/ui) and that an older, oxfmt-formatted section updates, stays formatted and then reports unchanged; packages/create/src/create.test.ts checks AGENTS.md, CLAUDE.md, the skill and README.md of each scaffolded template with oxfmt. reference/cli.md says the files are oxfmt-stable.
<!-- SECTION:NOTES:END -->
