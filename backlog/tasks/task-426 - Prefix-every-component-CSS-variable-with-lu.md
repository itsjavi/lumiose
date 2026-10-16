---
id: TASK-426
title: Prefix every component CSS variable with --lu-
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-16 09:19'
updated_date: '2026-10-16 09:49'
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
- [x] #1 No component exposes an unprefixed custom property; a test enforces it
- [x] #2 The docs list the --lu- names and note the mapping from Base UI's
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux): renamed --collapsible-panel-*, --accordion-panel-*, --toast-index, --toast-swipe-movement-x/y, --drawer-swipe-movement-x/y, --drawer-swipe-progress and --nested-dialogs to --lu-… (68 occurrences in 21 files: sources, theme, docs, ui-e2e tests, the MCP reference and its test). packages/ui/src/css-vars.test.ts fails on any unprefixed custom property a component sets or reads; it catches every old name. theming.md's 'Your own CSS' now lists Base UI's public state data-* attributes, the --lu- mapping from Base UI's names, and says part markers and config attributes are internal (decision-62 as amended). Checks: pnpm check, docs:check, ui-e2e Chromium 802 passed, Firefox/WebKit 810 passed, apps/web 179, pack smoke.
<!-- SECTION:NOTES:END -->
