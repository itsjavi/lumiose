---
id: TASK-465
title: 'Escape on a closed Combobox clears it, as Base UI does'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 21:19'
updated_date: '2026-10-16 21:28'
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
- [x] #1 Escape on a closed Combobox with a value clears the input and the selection and fires the change; a second Escape reaches the parent
- [x] #2 An empty closed Combobox lets Escape through to a parent dialog
- [x] #3 Docs and e2e in Chromium, Firefox and WebKit
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Beacon): Done. combobox.script.ts: Escape on a closed combobox with text or a selection clears both through the same #clear() the Clear button uses (input and change events; Autocomplete: its text, as Base UI's Autocomplete) and cancels the key, so a parent dialog stays open; closed and empty, the key goes on. Tests: ui-e2e combobox-review.e2e.ts 'Escape on a closed combobox clears it, as Base UI's (TASK-465)': in the Language dialog, choose Português, Escape clears it with one change and the dialog stays, the next Escape closes the dialog; City outside a dialog; an Autocomplete's text after the suggestions close. Fail without the change in Chromium (build), Firefox and WebKit; the existing combobox and autocomplete suites pass in all three. Docs: the Escape rows of combobox.md and autocomplete.md.
<!-- SECTION:NOTES:END -->
