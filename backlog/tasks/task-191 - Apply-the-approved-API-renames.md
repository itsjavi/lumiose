---
id: TASK-191
title: Apply the approved API renames
status: To Do
assignee:
  - Lux
created_date: '2026-10-10 03:33'
labels:
  - api
  - dx
dependencies:
  - TASK-190
priority: high
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the renames the user approves from TASK-190 across the runtime, compiler-emitted imports if any, typings, language tooling, examples, apps, docs and llms.txt. Split into per-owner tasks once the list is approved.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every approved rename applied; old names removed or aliased as approved, with a changelog entry
- [ ] #2 Docs, examples and diagnostics updated in the same commits; pnpm check green
<!-- AC:END -->
