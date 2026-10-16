---
id: TASK-462
title: 'UI test kit: wider WCAG helpers and activation-free probes'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 13:45'
updated_date: '2026-10-16 21:50'
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
- [x] #1 smallTargets covers inline links (the WCAG exceptions aside), summary, options and scrollbar thumbs; focusRing checks the ring's contrast
- [x] #2 Every drawer and popup state the suites open is axe-checked; reflow at more than one size; forced-colors checks for the themed components
- [x] #3 A probe without user activation covers CloseWatcher-dependent dismissal
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Beacon): done.
- a11y.ts: smallTargets covers stand-alone links (an inline link with text of its own around it is the WCAG exception), summary, options, menu items and scroll thumbs; focusRing returns the ring with its contrast against what is behind it (composited backgrounds), so a test expecting "2px solid" fails under 3:1; new forcedColorsIssues finds controls drawn by their background alone.
- Found by the wider smallTargets: the drawer Menu link and the navigation-menu page link (18px tall). Fixed in the fixtures (24px targets).
- drawer.e2e.ts runs axe with the Menu drawer open too; layers.e2e.ts runs axe with nested hover popovers and a popover in a dialog open.
- reflow.e2e.ts: every fixture the home page lists at 320x256 and 1280x256, no sideways scroll, nothing clipped; the overflow fixtures make on purpose is listed with its reason (popover Next step, the padded placements row in Firefox, a slider's overhanging thumbs).
- forced-colors.e2e.ts: every fixture's controls keep a boundary, and the first focus ring is visible against Canvas. Found in Firefox: a focused pressed toggle drew its ring in HighlightText on Canvas (1:1). Fixed in the default theme (outline-color CanvasText under forced colours), documented in theming.md. WebKit has no forced-colours emulation and skips.
- layers.e2e.ts: an init-script probe records navigator.userActivation at each Escape. The nested hover popovers test now asserts its first Escape came from a page that never had activation; a new test opens a hover popover in a dialog after the dialog's 5 s activation expired and checks one Escape closes only the popover.
Checks: the changed suites in Chromium (build), Firefox and WebKit.
<!-- SECTION:NOTES:END -->
