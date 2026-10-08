---
id: TASK-9
title: Implement client JSX codegen
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 13:25'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-8
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client output is where Lumen's performance comes from: template cloning plus fine-grained bindings, compiled idioms and delegation (spec §4.5, §5.2, §6.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hoisted minified templates with path walks; effect(compute, apply) bindings with hoisted apply functions; one-time writes for static values; signals passed directly as sources
- [ ] #2 Components with getter props, reactive props destructuring and rest; children; ref; bind:value/checked; attach; class and style objects
- [ ] #3 Compiled .map() keyed lists, selector patterns (both operand orders) and memoised branches; delegated onX with data-slot hoisting, native on:x
- [ ] #4 Diagnostics LUM2001 to LUM2006; golden fixtures match the compiler-runtime contract; output is JS with types stripped
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-42 and user decision-17 amendment): delegated event props are React-style camelCase (onKeyDown, onMouseEnter, onDblClick). Codegen lowercases the suffix after 'on' to get the DOM event name (onKeyDown → keydown, delegated if in the bubbling list). on:x keeps the exact name.

Lux: event props come from packages/lumen/src/jsx/events.ts (delegatedEvents table, 104 camelCase names that lowercase to DOM names). onX for a bubbling event is delegated (el.$$name); onX for a non-bubbling event (mouseenter, mouseleave, focus, blur, scroll, load, error, …) compiles to listen(el, name, handler), a direct listener. No diagnostic either way (decision-17 clarification).

Lux: please add a 6xxx range (tooling/config) to the diagnostics registry, with LUM6001 'tsconfig is missing options required by Lumen' (used by lumen check, TASK-27).
<!-- SECTION:NOTES:END -->
