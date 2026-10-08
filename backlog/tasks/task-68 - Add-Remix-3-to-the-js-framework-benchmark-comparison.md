---
id: TASK-68
title: Add Remix 3 to the js-framework-benchmark comparison
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 16:20'
labels: []
milestone: m-1
dependencies:
  - TASK-12
priority: medium
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants the benchmark table to include Remix 3 (remix-run), a new framework too. remix@3.0.0 (stable, published after the 3.0.0-rc.5 RC) ships remix/component 1.0, a setup/render virtual-DOM component model. krausest has no Remix 3 implementation yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A keyed js-framework-benchmark implementation for remix/component 1.0 (remix@3.0.0) following krausest's rules and Remix's idioms (handle.update(), on() mixins), passing isKeyed and the HTML checks
- [ ] #2 pnpm bench:jsfb includes it next to lumen, vanilla, solid, svelte, vue-vapor and react; RESULTS.md updated with CPU, memory and size
<!-- AC:END -->
