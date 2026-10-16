---
id: TASK-452
title: 'Release review, Low: Toolbar and Menu'
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
ordinal: 450000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Toolbar and Menu. Fix each, or record why it stays.

**Toolbar and Menu**
- **L26.** Toolbar.Input:
  - arrowing in leaves the caret at 0 (BU selects the value);
  - Shift+ArrowRight at the end leaves the field.
- **L27.** Menu without JS: Escape in a submenu leaves focus on a hidden item.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L26: Toolbar.Input:
  - arrowing in leaves the caret at 0 (BU selects the value);
  - Shift+ArrowRight at the end leaves the field.
- [ ] #2 L27: Menu without JS: Escape in a submenu leaves focus on a hidden item.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
