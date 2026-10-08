---
id: TASK-43
title: Align JSX event types with camelCase handler names
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:49'
updated_date: '2026-10-08 12:50'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/jsx/events.ts: documented const object DelegatedEvents (camelCase suffix -> DOM event name) covering HTMLElementEventMap + SVGElementEventMap names; types derived from it.
2. jsx-runtime.ts: replace on${Capitalize<event>} with mapped props from the table (event type from the element's event map, typed currentTarget); exact-case forms (onKeydown) rejected; keep on:x exact names + on:${string} custom fallback.
3. Fix ref<T>() hole: make ref accept only callbacks whose parameter accepts the element (reject Ref<OtherElement>) or document if TS cannot express it.
4. Update fixtures (accepted + rejected) and a table-consistency check (every value is a key of the DOM event maps, lowercase(key) === value).
5. Validate: jsx type tests, pnpm test, pnpm lint, pnpm typecheck (note unrelated failures).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: claimed (session beacon-task43-20261008T125006Z), standalone worker under Lux.
<!-- SECTION:NOTES:END -->
