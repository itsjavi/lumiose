---
id: TASK-455
title: 'Release review, Low: Theme and test kit'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:08'
updated_date: '2026-10-16 13:46'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 453000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Theme and test kit. Fix each, or record why it stays.

**Theme and test kit**
- **L34.** Theme: a focused `aria-disabled` menu item fades its ring to 2.05:1 (`opacity: .5`). Dim the text instead, as tabs do.
- **L35.** Test kit:
  - the drawer suite axes only "Filters" open (the "Menu" drawer's link is a 43x18 target-size violation);
  - `smallTargets` skips every inline link and misses `summary`, `[role=option]` and scrollbar thumbs;
  - `focusRing` checks no colour;
  - reflow is checked only at 320x640;
  - no forced-colors checks;
  - Playwright's Chromium activation hides CloseWatcher bugs (H1).
  Task: "UI test kit: wider WCAG helpers and activation-free probes".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L34: Theme: a focused `aria-disabled` menu item fades its ring to 2.05:1 (`opacity: .5`).
- [x] #2 L35: UI test kit: wider WCAG helpers and activation-free probes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): L34 fixed in themes/default.css (additive, one rule): a disabled menu item is dimmed by its text colour, as tabs are, not opacity, so its focus ring keeps full contrast. Test: ui-e2e theme-lows.e2e.ts (a focused disabled item has opacity 1 and a dimmer colour than an enabled one), failing without the fix in Chromium (build), Firefox and WebKit. L35 filed as TASK-462 (Prism's suggested task: wider WCAG helpers and activation-free probes).
<!-- SECTION:NOTES:END -->
