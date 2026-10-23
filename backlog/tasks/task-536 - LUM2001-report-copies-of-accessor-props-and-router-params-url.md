---
id: TASK-536
title: 'LUM2001: report copies of accessor props and router params()/url()'
status: To Do
assignee:
  - Photon
created_date: '2026-10-23 19:36'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 529000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-529 made LUM2001 report `const n = count()` for signals, computeds, resources and optimistics made in the same file. Two kinds of copy stay unreported: destructured accessor props (`const { value } = props; const v = value()`) and the accessors of lumiose/router (`params()`, `url()`, `searchParams()`). Decide which can be reported without false positives (decision-77: errors for signal reads, warnings for prop reads) and report them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 LUM2001 reports a copied accessor prop and copies of router accessors that are reactive, with tests and the golden updated
- [ ] #2 No new false positives in apps/web, the examples, ui, site-kit or the fullstack app
- [ ] #3 The LUM2001/LUM2003 pages describe what is and is not reported
<!-- AC:END -->
