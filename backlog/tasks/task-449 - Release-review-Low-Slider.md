---
id: TASK-449
title: 'Release review, Low: Slider'
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
ordinal: 447000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Slider. Fix each, or record why it stays.

**Slider**
- **L21.** With `"none"`, a blocked move fires input, change and onValueCommitted. With push, Home or End collapses a range (documented; BU and APG stop at the neighbour).
- **L22.** Inside a Field, `Slider.Label`/`Value` `for` point at `…-thumb-0`, which doesn't exist (by code).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L21: With `"none"`, a blocked move fires input, change and onValueCommitted.
- [ ] #2 L22: Inside a Field, `Slider.Label`/`Value` `for` point at `…-thumb-0`, which doesn't exist (by code).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.
<!-- SECTION:NOTES:END -->
