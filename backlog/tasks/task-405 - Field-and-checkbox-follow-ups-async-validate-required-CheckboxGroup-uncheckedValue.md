---
id: TASK-405
title: >-
  Field and checkbox follow-ups: async validate, required CheckboxGroup,
  uncheckedValue
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 22:29'
updated_date: '2026-10-16 02:29'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-365
  - TASK-366
  - TASK-368
priority: low
ordinal: 404000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Halo in TASK-365 to TASK-368 (2026-10-15). Field: an async `validate` that drops stale results, and `Field.Validity`. CheckboxGroup: `required`. Checkbox and Switch: `uncheckedValue`, so an unchecked control still submits a value. Compare with Base UI before adding each.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each item is implemented with docs and e2e, or recorded as dropped with its reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo), compared with Base UI 1.x:
- Async `validate`: implemented. `validate` may return a promise; each run takes a ticket and only the latest applies (a slower, older check is dropped). While pending the control's custom validity is cleared, `<lu-field>` has `data-validating` and Field.Validity reports `validating`. On settle Field.Root sets the custom validity and fires `validitychange` (not bubbling) on the control; field.script.ts renders the field again. A rejected check counts as no error; a submit that comes first is not blocked (as Base UI says). The blur's `change` after an edit does not re-check the same value (it used to clear the verdict before the submit). Initial and post-reset checks are quiet (no Field.Validity check); a reset now re-validates the default value (custom validity used to stay stale after a reset). Added Base UI's `validationDebounceTime` (typing pause before `validate`).
- `Field.Validity`: implemented, island render-function child with `{ validity (valid null until first check), error, errors, value, validating }`, updated on edit, blur, submit attempt (capturing `invalid`), validate results and server errors; reset makes it unchecked. Found a runtime dev-hydration bug with an element-valued region (filed TASK-415); docs advise text inside the user's element, which works in dev and build.
- CheckboxGroup `required`: dropped. Base UI has none; HTML has no group constraint, so it would be script-only with an unlocalized message of ours. Docs point to a server check with `fail()` (checkbox-group.md).
- Checkbox and Switch `uncheckedValue` (Base UI has it): implemented as `data-unchecked-value`, appended by checkbox.script.ts on the form's `formdata` event for unchecked, enabled, named boxes (after the other values). Without the script nothing is submitted, as natively (documented).
Tests: SSR (Validity unchecked and with server errors, data-unchecked-value), type tests, e2e (latest edit wins over a slow stale check, debounce counts one check for five keystrokes, onChange shows the async error with aria-invalid and the description, submit blocked and focus, reset clears; uncheckedValue submits newsletter=off and a disabled switch nothing). Sizes: field script 1.06 kB brotli (was ~1.0), checkbox script 0.55 kB (was ~0.5). Proposed names: Field.Validity, FieldValidityProps, FieldValidityState, validationDebounceTime, data-validating, the validitychange event, uncheckedValue, data-unchecked-value.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Field: async validate (latest edit wins, data-validating, validitychange to the script, no re-check of an unchanged value, quiet initial and post-reset checks), validationDebounceTime and Field.Validity. Checkbox and Switch: uncheckedValue through the formdata event. CheckboxGroup required: dropped with its reason (not in Base UI, no native group constraint; server check documented). Docs (field, checkbox, switch, checkbox-group) and e2e updated. Follow-up TASK-415 (runtime dev hydration of element-valued regions).
<!-- SECTION:FINAL_SUMMARY:END -->
