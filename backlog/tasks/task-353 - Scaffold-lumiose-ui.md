---
id: TASK-353
title: Scaffold @lumiose/ui
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-333
priority: high
ordinal: 354000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Create packages/ui (@lumiose/ui): exports per component, its own 0.x versions outside lockstep (TASK-333), CSS in the lu.tokens, lu.core and lu.theme cascade layers, a size budget reported by pnpm size (decision-55: measured separately from the runtime cap), and a UI section in the docs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The package builds, type-checks and packs with its own version
- [ ] #2 pnpm size reports its JS and CSS per component
- [ ] #3 The docs have a UI section, even if it only lists what is coming
<!-- AC:END -->
