---
id: TASK-252
title: 'View transitions: viewTransition() and <ViewTransition>'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 19:31'
labels:
  - runtime
  - api
  - router
milestone: m-9
dependencies:
  - TASK-247
priority: medium
ordinal: 254000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-43. viewTransition(fn) runs an update inside document.startViewTransition with flush(), falling back without support or with reduced motion; the SPA router uses it for navigations. <ViewTransition name? enter? exit?> names its single child (useId() by default) and applies enter/exit classes so conditionals and lists animate. Opt-in imports, tree-shaken.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 viewTransition() works with signals (DOM updated inside the transition) and falls back cleanly
- [ ] #2 <ViewTransition> animates enter, exit and moves of conditionals and keyed lists; SPA navigations use viewTransition()
- [ ] #3 Runtime size stays under the cap when unused; docs and tests (happy-dom + a browser check)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: SPA navigations use viewTransition() only when the existing lumiose({ viewTransitions: true }) option is on.
<!-- SECTION:NOTES:END -->
