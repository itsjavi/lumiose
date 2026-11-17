---
id: TASK-606
title: >-
  Benchmarks, showcase, playground, examples and error pages in the new look;
  the stack table moves to /benchmarks
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T12:57:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 598000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restyle the remaining site pages to the redesign: /benchmarks, /showcase, /playground, /examples, /stsx, the errors pages and not-found. The stack comparison table moves from the landing to /benchmarks (user, 2026-11-17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /benchmarks shows the stack table, still fed by the committed results through the content modules
- [ ] #2 Charts are monochrome, with amber only for the Lumiose series
- [ ] #3 Each page is shorter or equal in length: no new copy blocks
- [ ] #4 Unit and e2e suites of apps/web pass, a11y suite included
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-602 (Lux): src/playground/samples.ts hard-codes old brand colours. The local build of the web app fails at the playground wasm step when the wasm-bindgen CLI version differs from the pinned one; lumiose build runs without it.
<!-- SECTION:NOTES:END -->
