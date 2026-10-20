---
id: TASK-486
title: 'itsjavi.com port: switch to ?client and record its scorecard'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:22'
labels: []
milestone: m-13
dependencies:
  - TASK-485
priority: medium
ordinal: 482000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the itsjavi.com port's theme toggle, search and other small scripts from islands to ?client once 0.5.0 is on npm, then record its scorecard against the Astro site in doc-11: JavaScript per page, requests, build time, source lines and what got easier or harder (decision-70).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The port uses ?client wherever it used an island only for a small script
- [ ] #2 doc-11 holds the itsjavi.com scorecard with numbers and DX notes
- [ ] #3 Gaps found become tasks in this backlog
<!-- AC:END -->
