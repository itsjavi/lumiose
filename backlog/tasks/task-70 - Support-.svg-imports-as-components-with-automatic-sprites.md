---
id: TASK-70
title: Support .svg imports as components with automatic sprites
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
labels:
  - needs-decision
milestone: m-3
dependencies:
  - TASK-59
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants SVG imports as components (almost every modern app needs icons), handled as a separate study: find a way to support SVG sprites automatically so the final HTML stays much leaner than inlining every icon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Study recorded in the task notes: inline SVG components vs external sprite sheets (<use href='sprite.svg#id'>) vs inline per-page sprite (<svg hidden><symbol>… once per document), with HTML weight, caching, CSS styling (currentColor), SSR/islands/SPA behaviour and a11y trade-offs; recommendation for Lux/user
- [ ] #2 Implementation per the approved recommendation: import Icon from './x.svg' gives a component accepting standard SVG props; the build dedupes repeated icons into a sprite automatically; SVGO-style optimisation (Rust if available); types; tests; docs
<!-- AC:END -->
