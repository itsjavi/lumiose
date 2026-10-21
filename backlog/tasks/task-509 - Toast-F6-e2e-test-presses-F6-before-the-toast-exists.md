---
id: TASK-509
title: Toast F6 e2e test presses F6 before the toast exists
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 04:59'
labels:
  - test
dependencies: []
priority: high
ordinal: 505000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Flaky in CI e2e (ubuntu), dev project only, 2 of 5 runs with the test (38880800285, 39523378481): examples/ui-e2e/e2e/toast.e2e.ts 'F6 focuses the region; Escape and Shift+Tab return focus' clicks 'Add an error' right after goto and presses F6 once the button has focus; the region stays unfocused. F6 only moves focus to a region that shows a toast (toast.script.ts). When the click comes before the island hydrates, the loader holds it and replays it a task after hydration; an F6 in between finds no toast (TASK-508). Not reproduced by load alone (30 repeats under CPU load pass); reproduced deterministically by widening that window (island module delayed, 0 ms timers stretched): 'Received: inactive', as in CI. The test now waits for the toast before F6, as the next test already does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test waits for the toast before pressing F6
- [ ] #2 It passes with the replay window widened, and 5 repeats under CI settings and CPU load
<!-- AC:END -->
