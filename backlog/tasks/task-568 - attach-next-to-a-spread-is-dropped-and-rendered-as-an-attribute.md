---
id: TASK-568
title: attach next to a spread is dropped and rendered as an attribute
status: To Do
assignee:
  - Photon
created_date: '2026-10-24 17:02'
labels:
  - compiler
  - bug
dependencies: []
priority: high
ordinal: 560000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo while building the virtualizer components (TASK-565), on Lumiose 0.7.0. When an element has a spread, the compiler moves its other props into `spread(el, () => mergeProps(rest, { … }))`, and `attach` goes with them: the runtime's spread (packages/lumiose/src/dom/spread.ts) handles `ref` but not `attach`, so the attachment never runs and the element gets an `attach` attribute holding the function's source.

Repro (client output):

```tsx
<li {...props.itemProps?.(item)} data-row={i} attach={[(el) => observe(el)]} />
// renders <li data-row="0" attach="(el) => observe(el)"> and observe never runs
```

Expected: `attach` works next to a spread as without one (the compiler keeps it out of the merged props and emits its `attach` call, or the spread runtime applies it), and it never becomes an attribute. The virtualizer components avoid it by observing their rows from the container (packages/ui/src/virtualizer/virtual.tsx, containerRef).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An element with a spread and attach={[fn]} runs fn with the element, as without the spread, with a test
- [ ] #2 No attach attribute is ever written to the DOM
<!-- AC:END -->
