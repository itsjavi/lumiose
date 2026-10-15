---
id: TASK-401
title: 'LUM2001 false positive: a member call on an imported object'
status: To Do
assignee: []
created_date: '2026-10-15 21:48'
labels:
  - compiler
  - lum2001
dependencies: []
priority: medium
ordinal: 400000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-371 (Beacon, 2026-10-15). Inside a component, `const toasts = Toast.createToastManager();` warns LUM2001 ("`toasts` is computed once from a reactive value"), though nothing reactive is read. The same call through a named import (`createToastManager()`), wrapped in `untrack`, or at module scope does not warn. The analysis seems to treat any member call on an import (`X.y()`) as a reactive read, like a props access. Workaround in @lumiose/ui: a named export `createToastManager`, and docs/toast.md tells users to call it in components. Fix the analysis so a call on a module import is not reactive unless its arguments are, and add a compiler test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A member call on an imported module object inside a component does not warn LUM2001
- [ ] #2 Reading a reactive prop through a member call still warns
<!-- AC:END -->
