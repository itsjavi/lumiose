---
id: TASK-70
title: Support .svg imports as components with automatic sprites
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-08 16:20'
updated_date: '2026-10-08 20:48'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Study only (AC #1); implementation (AC #2) waits for the user's decision. 1) Read how Lumen compiles JSX templates, SSR, islands and the CSS manifest to see where an SVG transform and a sprite collector would plug in. 2) Measure HTML weight on a realistic page (a real icon set, e.g. lucide/heroicons-sized paths, ~30 icon uses with repeats): inline per use vs per-document inline sprite vs external sprite, raw and gzip/brotli. 3) Compare caching, currentColor/CSS styling, SSR/islands/SPA navigation/streaming, a11y, HMR, CSP/cross-origin, browser quirks. 4) Propose API shape (import Icon from './x.svg', props, ?url/?raw variants, types) and a recommendation for the user. Scratch in .local/agents/Halo/halo-20261008T203613Z/.
<!-- SECTION:PLAN:END -->
