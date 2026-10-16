---
id: TASK-447
title: 'Release review, Low: Number Field'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 12:34'
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
- [ ] #1 L17: The wheel:
  - a focused field traps page scroll;
  - Ctrl+wheel is `preventDefault`ed (no zoom) and steps with allowWheelScrub;
  - horizontal swipes step.
- [ ] #2 L18: A mouse press on a stepper leaves focus on body (documented); the next ArrowUp does nothing.
- [ ] #3 L19: Firefox: "12abc" stays shown after commit.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).
<!-- SECTION:NOTES:END -->
