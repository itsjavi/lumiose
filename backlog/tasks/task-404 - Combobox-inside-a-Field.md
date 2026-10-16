---
id: TASK-404
title: Combobox inside a Field
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 22:29'
updated_date: '2026-10-16 00:22'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-365
  - TASK-358
priority: medium
ordinal: 403000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Halo in TASK-365 (2026-10-15). Inside a Field, Combobox.Input should take the field's id and ARIA references (label, description, error), as Select does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Combobox.Input inside Field.Root is labelled, described and marked invalid by the field, with e2e
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 sixth batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits 83dc0d19, 34d29559, 0d478821).

Combobox.Input inside a Field takes the field's control id (so Field.Label labels it), aria-describedby (description, and the error while invalid from the server) and aria-invalid; Combobox.Root takes the field's name and disabled state. Field's script already showed a combobox's validation through its input (TASK-365); an Autocomplete's free element is now skipped as a control so its input is the one validated. Combobox.Label points at the input's actual id.

Evidence: unit test autocomplete/autocomplete.test.tsx "Combobox and Autocomplete in a Field" (server HTML); ui-e2e e2e/autocomplete.e2e.ts "Combobox and Autocomplete in a Field" (labelled by Field.Label, described by Field.Description, marked aria-invalid with the browser's message in Field.Error on a submit attempt, valid again after a choice, submitted under the field's name). Docs: combobox.md (Input inside a Field), field.md. Screenshot: backlog/assets/task-404-combobox-in-field.png.

2026-10-16 (Halo): checks green (see TASK-375). Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Combobox inside a Field takes the field's control id, description and error references and aria-invalid on its input, and the field's name and disabled state on its Root; the Field shows its validation, and an Autocomplete's input is validated as the control. Server-HTML unit test and an e2e (labelled, described, marked invalid on a submit attempt, valid after a choice, submitted under the field's name); docs updated; all checks green.
<!-- SECTION:FINAL_SUMMARY:END -->
