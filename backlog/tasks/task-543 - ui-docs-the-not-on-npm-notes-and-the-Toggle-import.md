---
id: TASK-543
title: 'ui docs: the not-on-npm notes and the Toggle import'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
labels:
  - ui
  - docs
dependencies: []
priority: medium
ordinal: 536000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). The published README.md and installation.md still say @lumiose/ui is not on npm yet. toggle-group.md imports Toggle from @lumiose/ui/toggle-group, which does not export it (it comes from @lumiose/ui/toggle).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 README.md and installation.md describe installing from npm
- [ ] #2 toggle-group.md's examples import Toggle from @lumiose/ui/toggle, and a docs test type-checks them
<!-- AC:END -->
