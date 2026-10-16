---
id: TASK-460
title: 'Combobox: back navigation restores the selection and keeps the reset default'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 13:42'
updated_date: '2026-10-16 15:39'
labels:
  - ui
milestone: m-12
dependencies: []
priority: low
ordinal: 458000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-454 L32 (Prism). After a back navigation, the browser restores the inner input's text and the element's form state, and the combobox then takes the restored state as its reset default (`#defaults` read from the restored options), so a later reset goes to the restored value instead of the server's. Implement formStateRestoreCallback (setFormValue with a state) and keep the server's selection as the default; check bfcache and non-bfcache in each engine.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After a back navigation the user's selection is restored, and a reset goes back to the server's default, with tests in every engine
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.
<!-- SECTION:NOTES:END -->
