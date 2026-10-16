---
id: TASK-451
title: 'Release review, Low: Navigation Menu'
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
- [ ] #1 L24: Panels keep native `popover=auto` light dismiss: a right-click (and a press in a toast) closes them.
- [ ] #2 L25: No hover safe area toward a wide panel; the path crosses the next trigger, which takes over.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
