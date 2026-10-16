---
id: TASK-464
title: 'Flaky under load: the OTP Field no-JavaScript test in Firefox'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 16:12'
labels:
  - ui
  - test
milestone: m-12
dependencies: []
priority: medium
ordinal: 462000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen at the fix batch 2 merge (2026-10-16). examples/ui-e2e/e2e/otp-field.e2e.ts:44 ('without JavaScript: the input is a plain field that validates its pattern and submits') failed once in a full Firefox/WebKit run. Beacon saw the same thing in batch 2. On its own it passes 8 of 8 in Firefox. The ui-browsers CI job could hit it, so find the timing assumption and make the test robust.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test passes repeatedly inside a full Firefox run (e.g. --repeat-each in a full-suite run)
<!-- AC:END -->
