---
id: TASK-242
title: 'Fullstack benchmark: Astro port'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-11 03:48'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11: Astro gets a fullstack app, so the stack table's 'Requests' and 'JS on a server page' cells can be measured for the other 0 kB framework. Port the doc-4 issue tracker to Astro in benchmarks/fullstack/apps/astro: server output (adapter-node), Astro components for the pages, and the interactive parts as Preact islands (the lightest common integration; record the choice and why in doc-4). Use the latest stable versions (decision-41), with production settings comparable to the others. Pass conformance; register it in the harness and the viewer. No quick bench passes now: the user's machine is busy, and TASK-235 measures it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 benchmarks/fullstack/apps/astro implements the doc-4 app idiomatically and passes conformance; versions and caveats are in doc-4
- [ ] #2 The harness and viewer know the app; measurement is left to TASK-235
<!-- AC:END -->
