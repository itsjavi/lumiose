---
id: TASK-439
title: 'Release review, Medium: Field, Form, form controls'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:08'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: medium
ordinal: 437000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Field, Form, form controls. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M25. CheckboxGroup inside Field.Root.** CONFIRMED (SSR plus browser).
- Every checkbox gets `id="…-control"`, Field.Label names the first box, and every box gets `aria-invalid`. Clicking the label toggles select-all.
- **Violates:** WCAG 1.3.1, 4.1.2; BU CheckboxGroup tests.
- **Fix:** checkboxes in a group skip the field id and aria; the group takes the wiring (`aria-labelledby`), as RadioGroup should.

**M26. RadioGroup in a Field with Field.Label: the label's `for` matches nothing, so the group is unnamed.** CONFIRMED.
- `aria-describedby="…-error"` dangles whenever the Errors have children or `match` (any invalid field without JS).
- **Fix:** label the radiogroup by the label id; `describedBy()` references only rendered Error ids.

**M27. Form/Field: no focus on the first invalid field after a server error.** CONFIRMED.
- In the island, focus stays on Save; on a full page load it is on body.
- **Violates:** BU Form `focusFirstInvalid` on errors; WCAG 2.4.3 and 3.3.1 usability.
- **Fix:** an effect in islands; `autofocus` or `meetAll` focus for server HTML.

**M28. Field script: a silent `checkValidity()` shows errors and steals focus.** CONFIRMED in 3 engines.
- **Fix:** act only during a submit (submitter click, implicit Enter, requestSubmit or reportValidity).

**M29. Field script: on submit, focus and the native bubble go to a later Field-less invalid control, not the first Field.** CONFIRMED in 3 engines.
- **Violates:** doc-9 §15.
- **Fix:** compute the first invalid control and cancel the other `invalid` events.

**M30. Fieldset `disabled` doesn't stop Slider track presses or Number Field scrub and buttons.** CONFIRMED in Chromium and Firefox.
- **Cause:** the scripts check `.disabled`, not `:disabled`.
- **Fix:** `matches(":disabled")` in slider.script and number-field.script.

**M31. `<output>` parts are polite atomic live regions: Field.Error and Slider.Value over-announce.** CONFIRMED in Chromium's AX tree.
- Every keystroke re-announces a changing Field error, and every slider step is announced twice.
- **Violates:** BU uses `div` / `aria-live="off"`; WCAG 4.1.3 (verbosity).
- **Fix:** `aria-live="off"` on both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M25: CheckboxGroup and RadioGroup: Field wiring
- [ ] #2 M26: Field: aria-describedby names only rendered Error ids
- [ ] #3 M27: Form: focus the first field with a server error
- [ ] #4 M28: Field script: ignore invalid events from checkValidity()
- [ ] #5 M29: Field script: the first invalid control wins
- [ ] #6 M30: Slider, Number Field: honour a disabled fieldset
- [ ] #7 M31: Field.Error and Slider.Value: not live regions
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).
<!-- SECTION:NOTES:END -->
