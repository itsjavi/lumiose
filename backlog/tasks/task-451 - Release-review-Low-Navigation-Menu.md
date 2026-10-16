---
id: TASK-451
title: 'Release review, Low: Navigation Menu'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:51'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 449000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Navigation Menu. Fix each, or record why it stays.

**Navigation Menu**
- **L24.** Panels keep native `popover=auto` light dismiss: a right-click (and a press in a toast) closes them. Use layer.ts.
- **L25.** No hover safe area toward a wide panel; the path crosses the next trigger, which takes over.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L24: Panels keep native `popover=auto` light dismiss: a right-click (and a press in a toast) closes them.
- [x] #2 L25: No hover safe area toward a wide panel; the path crosses the next trigger, which takes over.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- L24: the element makes a content popover=manual when it opens it and registers it with layer.ts (openLayer: contains = the item, so a nested menu and the trigger are inside; dismiss closes that item and returns focus to the trigger after a close request from inside). A manual popover closes no other, so #open hides the open one first. Server HTML keeps popover=auto. Right-clicks and presses in a toast no longer close a panel; a main-button press outside and Escape still do. The release runs on #hide and on any closed toggle (a parent closing the content it is in).
- L25: pointermove over a trigger records the last position; leaving the open item's trigger records it as the exit point. Another trigger the pointer enters inside the triangle exit → the content's near edge, within 300ms, waits 300ms before it opens (reaching the content cancels it), and the open content's close delay is 300ms on such a path. The close timer now hides only its item, so it cannot cancel a pending open.
- Tests: 'a right-click outside leaves a panel open' and 'on the way to a panel, crossing the next trigger keeps it' (a 40rem panel, a straight path from Products through Learn's lower left corner into the panel) fail without the change in dev, build, Firefox and WebKit; the whole nav menu spec passes in all four.
- Docs: navigation-menu.md (pointer, dismissal); script 3.2 kB brotli (was 2.2), the layer module being shared with Menu and Popover.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Navigation Menu panels use the shared layer dismissal (no right-click or toast close) and keep open while the pointer heads for them across another trigger. Regression tests in all engines.
<!-- SECTION:FINAL_SUMMARY:END -->
