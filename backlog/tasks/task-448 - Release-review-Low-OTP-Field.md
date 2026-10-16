---
id: TASK-448
title: 'Release review, Low: OTP Field'
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
ordinal: 446000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for OTP Field. Fix each, or record why it stays.

**OTP Field**
- **L20.** Typing does not overwrite the ringed slot; it inserts and shifts. BU replaces it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L20: Typing does not overwrite the ringed slot; it inserts and shifts.
<!-- AC:END -->
