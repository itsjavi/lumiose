---
id: TASK-467
title: 'Flaky under load: the popover safe-triangle timing test in Firefox'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 23:21'
updated_date: '2026-10-17 00:45'
labels:
  - ui
  - test
milestone: m-12
dependencies: []
priority: low
ordinal: 465000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen by Beacon in two full Firefox runs (2026-10-16 and 2026-10-17). The popover hover safe-triangle test (TASK-410, popover-hover-modal.e2e.ts) failed once in each run and passed 3 of 3 on rerun. Halo's TASK-464 found that one Firefox test can leak browser state into later tests: a real Ctrl+wheel zoomed the page. Look for a similar cause, or for a timing assumption.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The test passes repeatedly inside a full Firefox run
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-17): the timing assumption. hover.ts restarts a 100 ms grace at each move inside the triangle; the test's moves were 40 ms apart only on paper: each step was a remote mouse move, a 40 ms wait and a remote expect, so a loaded Firefox or WebKit could leave more than 100 ms between two moves and the grace ran out. Not the TASK-464 zoom leak: with the old Ctrl+wheel test before it, a different test of the file failed (a click timed out) and this one passed. Fix: from the open popup on, the page clock is installed and paused (page.clock.install + pauseAt; an installed clock alone still follows the wall clock, which my first attempt showed by failing 2 of ~50 runs) and the steps advance it with runFor(40), then runFor(200) before the final check. Evidence: with a 250 ms stall injected after each move, the new test passes in dev, build, Firefox and WebKit and the old one fails in all four; 40 of 40 repeats pass across the four projects. The full Firefox run is part of the batch's final checks.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The safe-triangle test runs the page's timers on a paused Playwright clock, so remote latency between moves can no longer use up the 100 ms grace; proven with an injected 250 ms stall (new passes, old fails, every project).
<!-- SECTION:FINAL_SUMMARY:END -->
