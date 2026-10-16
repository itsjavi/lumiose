---
id: TASK-445
title: 'Release review, Low: Avatar'
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
ordinal: 443000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Avatar. Fix each, or record why it stays.

**Avatar**
- **L8.** No JS: each avatar is named twice (image alt plus fallback); 6 images instead of 3 in the AX tree. Task: "Avatar fallback hidden from AT until the image fails".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L8: Avatar fallback hidden from AT until the image fails
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
