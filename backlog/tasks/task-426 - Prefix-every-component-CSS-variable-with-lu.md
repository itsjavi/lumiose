---
id: TASK-426
title: Prefix every component CSS variable with --lu-
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-16 09:19'
labels:
  - ui
milestone: m-12
dependencies: []
priority: high
ordinal: 424000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-16 (TASK-400, decision-62): every custom property a component exposes carries the --lu- prefix, like the theme's tokens. Rename --collapsible-panel-height, --accordion-panel-height, --toast-index, --toast-swipe-movement-x/y, --drawer-swipe-movement-x/y, --drawer-swipe-progress and --nested-dialogs to --lu-…, in sources, theme, docs, tests and site demos, and add a docs note mapping Base UI's --x to --lu-x.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No component exposes an unprefixed custom property; a test enforces it
- [ ] #2 The docs list the --lu- names and note the mapping from Base UI's
<!-- AC:END -->
