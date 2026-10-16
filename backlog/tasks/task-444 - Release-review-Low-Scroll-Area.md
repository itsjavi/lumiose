---
id: TASK-444
title: 'Release review, Low: Scroll Area'
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
ordinal: 442000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Scroll Area. Fix each, or record why it stays.

**Scroll Area**
- **L6.** No JS: an unscrollable viewport is an unnamed tab stop. Document it, or drop its `tabindex` on the server.
- **L7.** Scrollbars and thumbs are 6–10px, under the 2.5.8 target size. Give them a 24px hit area. Task: "Scroll Area scrollbars as 24px pointer targets".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L6: No JS: an unscrollable viewport is an unnamed tab stop.
- [ ] #2 L7: Scroll Area scrollbars as 24px pointer targets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
