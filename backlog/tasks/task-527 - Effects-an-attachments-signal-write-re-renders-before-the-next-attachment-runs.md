---
id: TASK-527
title: >-
  Effects: an attachment's signal write re-renders before the next attachment
  runs
status: To Do
assignee: []
created_date: '2026-10-23 09:05'
labels:
  - performance
  - core
  - needs-decision
milestone: m-13
dependencies: []
priority: medium
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while measuring TASK-522. When several attachments (or effects) run in one flush and each measures the DOM, then writes a signal the page renders, the scheduler runs the render work of each write before the next attachment runs (flush in core/effect.ts drains the render queue between user effects). Every measurement after the first then forces a fresh layout: the private-app port of TASK-492 measured 63 ms for 10 virtual-grid rows at full CPU speed, which at 4x CPU is about the whole gap TASK-522 reported against React (539 vs 284 ms); the TASK-522 grid A/B shows that inserting rows node by node was not the cost. React runs every layout effect of a commit before it renders their state updates together, and Solid holds writes made by effects until the running effects are done. Proposal: run the user effects already queued in a flush before the render passes that their writes trigger, so N measurements cost one layout. It changes what an effect sees: the DOM would not yet reflect a signal that an earlier effect of the same flush wrote, so it needs a decision first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision records whether user effects queued in one flush run before the render work their writes trigger, with its rationale
- [ ] #2 If they do: an in-process browser A/B of N attachments that measure and then write shows one forced layout instead of N, and the effect ordering tests stay green
- [ ] #3 The JSX docs (When attach runs) match the behaviour
<!-- AC:END -->
