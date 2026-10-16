---
id: TASK-417
title: 'OTP Field: typing over the caret''s character fails in WebKit'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 03:39'
labels:
  - ui
  - browsers
milestone: m-12
dependencies: []
ordinal: 415000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), in Linux WebKit (Playwright 1.63). otp-field.e2e.ts "typing fills the slots…": with all six slots full, Home, ArrowRight and typing 9 leaves 123456 instead of 193456 (Chromium and Firefox pass). The overtype at the caret depends on how WebKit handles input into a full field with maxlength. The test skips WebKit with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Typing into a full OTP field replaces the character at the caret in WebKit, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.
<!-- SECTION:NOTES:END -->
