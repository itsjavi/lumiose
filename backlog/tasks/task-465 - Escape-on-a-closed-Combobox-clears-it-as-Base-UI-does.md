---
id: TASK-465
title: 'Escape on a closed Combobox clears it, as Base UI does'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 21:19'
labels:
  - ui
milestone: m-12
dependencies: []
priority: medium
ordinal: 463000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-16 (TASK-457 Q5, decision-62). Pressing Escape in a closed Combobox (and Autocomplete, if Base UI does the same there) clears the input and the selection, as Base UI does and the APG pattern allows. Escape is consumed, so a parent dialog stays open: in a dialog, the first Escape clears and the second closes the dialog. A closed, empty Combobox lets Escape pass through. Update the docs' keyboard tables.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Escape on a closed Combobox with a value clears the input and the selection and fires the change; a second Escape reaches the parent
- [ ] #2 An empty closed Combobox lets Escape through to a parent dialog
- [ ] #3 Docs and e2e in Chromium, Firefox and WebKit
<!-- AC:END -->
