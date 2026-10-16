---
id: TASK-462
title: 'UI test kit: wider WCAG helpers and activation-free probes'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 13:45'
updated_date: '2026-10-16 15:39'
labels:
  - ui
  - test
  - a11y
milestone: m-12
dependencies: []
priority: low
ordinal: 460000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-455 L35 (Prism). examples/ui-e2e's helpers miss cases: (1) the drawer suite runs axe with only the "Filters" drawer open, so the "Menu" drawer's 43x18 link (a target-size violation) goes unchecked; (2) `smallTargets` skips every inline link and misses `summary`, `[role=option]` and scrollbar thumbs; (3) `focusRing` checks no colour or contrast; (4) reflow is checked only at 320x640; (5) there are no forced-colors checks; (6) Playwright's Chromium gives pages user activation, which hides CloseWatcher bugs (the H1 finding): add probes that run without activation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 smallTargets covers inline links (the WCAG exceptions aside), summary, options and scrollbar thumbs; focusRing checks the ring's contrast
- [ ] #2 Every drawer and popup state the suites open is axe-checked; reflow at more than one size; forced-colors checks for the themed components
- [ ] #3 A probe without user activation covers CloseWatcher-dependent dismissal
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.
<!-- SECTION:NOTES:END -->
