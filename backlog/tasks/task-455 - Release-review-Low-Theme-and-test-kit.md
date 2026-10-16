---
id: TASK-455
title: 'Release review, Low: Theme and test kit'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:08'
updated_date: '2026-10-16 12:34'
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
- [ ] #1 L34: Theme: a focused `aria-disabled` menu item fades its ring to 2.05:1 (`opacity: .5`).
- [ ] #2 L35: UI test kit: wider WCAG helpers and activation-free probes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).
<!-- SECTION:NOTES:END -->
