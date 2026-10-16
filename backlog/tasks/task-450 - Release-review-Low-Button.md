---
id: TASK-450
title: 'Release review, Low: Button'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 448000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Button. Fix each, or record why it stays.

**Button**
- **L23.** SUSPECTED: `focusableWhenDisabled` cancels only click; pointerdown, mousedown and keydown handlers still run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L23: SUSPECTED: `focusableWhenDisabled` cancels only click; pointerdown, mousedown and keydown handlers still run.
<!-- AC:END -->
