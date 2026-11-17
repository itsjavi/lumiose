---
id: TASK-607
title: 'Landing page: hero with live code, four rows, UI strip and a closing call'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-605
  - TASK-606
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 599000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild the landing to the reference: a left-aligned hero beside one live code example, four numbered rows (Write, Render, Hydrate, Measure) with one sentence and one link each, a strip of live @lumiose/ui components, and a closing install box. Everything else lives one click deeper.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The landing has only the sections of the reference; the stack table is on /benchmarks and the Measure row links to it
- [ ] #2 The code sample and its compiled output still come from this version of the compiler (content/samples.ts) and no number is hand-written
- [ ] #3 The hero counter is a real island and works without the playground bundle
- [ ] #4 Page meta, tagline and descriptor of decision-37 are unchanged
- [ ] #5 Screenshots of both themes at phone and desktop widths are in backlog/assets and linked here
<!-- AC:END -->
