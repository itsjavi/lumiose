---
id: TASK-447
title: 'Release review, Low: Number Field'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:33'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 445000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Number Field. Fix each, or record why it stays.

**Number Field**
- **L17.** The wheel:
  - a focused field traps page scroll;
  - Ctrl+wheel is `preventDefault`ed (no zoom) and steps with allowWheelScrub;
  - horizontal swipes step.
- **L18.** A mouse press on a stepper leaves focus on body (documented); the next ArrowUp does nothing. BU focuses the input.
- **L19.** Firefox: "12abc" stays shown after commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L17: The wheel:
  - a focused field traps page scroll;
  - Ctrl+wheel is `preventDefault`ed (no zoom) and steps with allowWheelScrub;
  - horizontal swipes step.
- [x] #2 L18: A mouse press on a stepper leaves focus on body (documented); the next ArrowUp does nothing.
- [x] #3 L19: Firefox: "12abc" stays shown after commit.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): Fixed L17, L18, L19 in number-field.script.ts. L17: Ctrl with the wheel and mostly horizontal swipes are left alone (zoom, no step); without allowWheelScrub, the wheel over a focused native field is cancelled (Chromium's stepping) and scrolls the nearest scrollable ancestor or the page instead. L18: a mouse press on a stepper focuses the input (preventScroll); a touch leaves focus. L19: commit of a badInput (Firefox's "12abc") restores the last number and clears the text. Tests: ui-e2e number-otp-review.e2e.ts 'Number Field Lows (TASK-447)' (L19 Firefox-only, the only engine that lets letters in), failing without the fixes in Chromium (build), Firefox and WebKit. number-field.md updated.
<!-- SECTION:NOTES:END -->
