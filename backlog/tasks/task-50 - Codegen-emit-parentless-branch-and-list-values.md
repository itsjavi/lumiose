---
id: TASK-50
title: 'Codegen: emit parentless branch and list values'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 14:11'
updated_date: '2026-10-08 16:48'
labels: []
milestone: m-1
dependencies:
  - TASK-49
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the runtime's parentless branch/list values (TASK-49) wherever codegen falls back to tracked functions today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Conditionals and .map() in component children, fragments and nested ternaries compile to branchValue/listValue; golden fixtures updated; execution tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (from TASK-18, hydration): the client now emits branchValue/listValue in value positions (children getters, fragments), but the server output still renders those as a plain ternary / `.map()` (e.g. `get children() { return on() ? ssr(_s2) : "inner no"; }`). Inside islands the server must emit `branch(cond, a, b)` / `list(source, render)` in exactly the positions where the client emits branchValue/listValue, so each value range gets its own `<!--[-->…<!--]-->` (or `<!--[!-->`) block: under hydration `branchValue`/`listValue` call `createRange(1)`, which claims the next server block at the cursor; with no block there the island falls back to a client render (LUM4006). Same for `.map()` in `<Suspense>`/component children. Hand-written server shapes that hydrate are in packages/lumen/src/dom/hydrate.test.ts ("parentless" cases).
<!-- SECTION:NOTES:END -->
