---
id: TASK-442
title: 'Release review, Low: Toast'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:03'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 440000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Toast. Fix each, or record why it stays.

**Toast**
- **L1.** A press on a toast's text pauses its timer until focus moves. The viewport is `tabindex=-1`. BU pauses on `:focus-visible` only. Task: "Toast timers pause on keyboard focus only".
- **L2.** Pulling a swipe back to 40px or more still closes the toast. BU cancels on a 10px reversal. Task: "Toast swipe cancels when the gesture reverses".
- **L3.** `touch-action` blocks pinch-zoom that starts on a toast. Use `pan-x pinch-zoom` and the like. Task: "Swipeable toasts keep pinch-zoom".
- **L4.** SUSPECTED: `add()` with an open toast's id remounts the toast instead of updating it. BU upserts. Task: "Toast add() with an existing id updates in place".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L1: Toast timers pause on keyboard focus only
- [ ] #2 L2: Toast swipe cancels when the gesture reverses
- [ ] #3 L3: Swipeable toasts keep pinch-zoom
- [ ] #4 L4: Toast add() with an existing id updates in place
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
