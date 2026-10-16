---
id: TASK-458
title: >-
  Parent checkbox: tri-state restore, disabled children, one count,
  aria-controls
status: To Do
assignee: []
created_date: '2026-10-16 13:20'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
ordinal: 456000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-446 L12 (Prism). A Checkbox Group's parent checkbox (`parent`): (1) no tri-state restore: Base UI's parent cycles mixed, all, none and back to the user's partial selection; ours forgets it; (2) disabled children are ignored when the parent toggles, but should keep their state and count as Base UI does; (3) the server (checkbox.tsx parentState, every allValues entry) and the script (checkbox.script.ts children(), enabled boxes only) count differently, so the parent can render one state and then change once the script runs; (4) the parent has no `aria-controls` naming the children.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The parent restores the user's partial selection after all and none, as Base UI's
- [ ] #2 Disabled children keep their state, and the server and the script count the same boxes
- [ ] #3 The parent has aria-controls with its children's ids, with tests in every engine
<!-- AC:END -->
