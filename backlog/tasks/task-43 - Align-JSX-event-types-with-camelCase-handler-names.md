---
id: TASK-43
title: Align JSX event types with camelCase handler names
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:49'
labels: []
milestone: m-1
dependencies:
  - TASK-42
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user approved React-style camelCase delegated handlers (decision-17 amendment), but TASK-42 typed handlers as on + Capitalize<eventname> (onKeydown).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Delegated handler props use an explicit camelCase table covering HTMLElementEventMap and SVG events (onKeyDown, onMouseEnter, onPointerDown, onDblClick, onFocusIn, …), where each name lowercases to a real DOM event name; exact-case forms like onKeydown are rejected
- [ ] #2 Native on:x props keep exact DOM names and allow custom event names
- [ ] #3 ref<T>() typing hole fixed or documented: a ref for the wrong element type is rejected
- [ ] #4 Type tests updated and passing on TS 7
<!-- AC:END -->
