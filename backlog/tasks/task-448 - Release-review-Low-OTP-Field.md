---
id: TASK-448
title: 'Release review, Low: OTP Field'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:33'
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
- [x] #1 L20: Typing does not overwrite the ringed slot; it inserts and shifts.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): Fixed L20: the OTP script's beforeinput replaces the character at the caret whenever the caret is before the end (not only in a full field), as Base UI's. Tests: otp-field.script.dom.test.ts and ui-e2e number-otp-review.e2e.ts 'L20', failing without the fix in all three engines. otp-field.md's key table updated.
<!-- SECTION:NOTES:END -->
