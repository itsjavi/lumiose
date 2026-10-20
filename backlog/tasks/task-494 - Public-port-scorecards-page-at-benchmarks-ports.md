---
id: TASK-494
title: Public port scorecards page at /benchmarks/ports/
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-20 21:35'
labels: []
milestone: m-13
dependencies:
  - TASK-486
priority: medium
ordinal: 490000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-74 and decision-70: publish the port scorecards on the website as a section of the benchmarks page, filled from committed data files like the other benchmarks (not from the backlog). Starts with itsjavi.com once TASK-486 records its scorecard; each later port (TASK-491, TASK-492, TASK-493) adds its own.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /benchmarks/ports/ renders each committed scorecard: the table of numbers and the easier/harder notes
- [ ] #2 The data lives in committed files next to the other benchmark results, and a test checks the page reads them
- [ ] #3 The benchmarks page links to it
<!-- AC:END -->
