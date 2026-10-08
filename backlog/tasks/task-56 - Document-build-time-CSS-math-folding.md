---
id: TASK-56
title: 'Document JS values in styles, including build-time math'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 15:58'
labels: []
milestone: m-5
dependencies:
  - TASK-55
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants build-time math documented together with the section on using JS values in styles ($name), so readers see in one place what can be used, what can't (e.g. function calls) and what gets precomputed. JS constants are folded by the Lumen compiler; CSS math on concrete values is folded by Lightning CSS (calc/min/max/clamp/trig; custom properties via TASK-55).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/concepts/styles.md has one section "JS values in styles" covering: what $name/$obj.key can reference (top-level and component consts, imported export consts, statically evaluable literals/template literals/arithmetic/as-const objects), what cannot (function calls, let, signals/props, array indexing) with the diagnostics, where values may appear (values and @media/@container/@supports, not selectors, strings, url()), and the style-prop bridge for runtime values
- [ ] #2 A "Build-time math" subsection in that section: examples table of what folds and what stays (%, vw, em/rem, var() are context-dependent), custom properties, credit to Lightning CSS
- [ ] #3 Reference, common mistakes and llms files updated; examples marked check pass
<!-- AC:END -->
