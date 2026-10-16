---
id: TASK-446
title: 'Release review, Low: Field and Checkbox'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:21'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 444000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Field and Checkbox. Fix each, or record why it stays.

**Field and Checkbox**
- **L9.** Field "dirty":
  - edit then erase, then Tab, shows no valueMissing;
  - an untouched required select or combobox shows its error on Tab-through.
  Track edits per control. Task: "Field: dirty means edited".
- **L10.** An error stays after its control becomes disabled. BU clears it.
- **L11.** Checkbox indeterminate is lost on form reset (3 engines).
- **L12.** Parent checkbox:
  - no tri-state restore;
  - disabled children ignored;
  - the server and the script count differently;
  - no `aria-controls`.
- **L13.** Radio Group with nothing checked: Shift+Tab lands on the last radio in Chromium and WebKit. Redirect it to the first enabled radio.
- **L14.** Two Descriptions, or two Errors with the same match, share one id, so one is read twice.
- **L15.** No JS:
  - a Description after the control is not linked;
  - a server indeterminate or parent checkbox is exposed as unchecked while drawn mixed.
- **L16.** SUSPECTED: sync `validate` with `validationDebounceTime` lets a submit inside the window bypass it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L9: Field: dirty means edited
- [x] #2 L10: An error stays after its control becomes disabled.
- [x] #3 L11: Checkbox indeterminate is lost on form reset (3 engines).
- [x] #4 L12: Parent checkbox:
  - no tri-state restore;
  - disabled children ignored;
  - the server and the script count differently;
  - no `aria-controls`.
- [x] #5 L13: Radio Group with nothing checked: Shift+Tab lands on the last radio in Chromium and WebKit.
- [x] #6 L14: Two Descriptions, or two Errors with the same match, share one id, so one is read twice.
- [x] #7 L15: No JS:
  - a Description after the control is not linked;
  - a server indeterminate or parent checkbox is exposed as unchecked while drawn mixed.
- [x] #8 L16: SUSPECTED: sync `validate` with `validationDebounceTime` lets a submit inside the window bypass it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): Fixed L9, L10, L11, L13, L14; tests in ui-e2e field-lows.e2e.ts (fixture /form/attempt gained a required Select in an onBlur field with two Descriptions and two valueMissing Errors), each failing without the fix in Chromium (build), Firefox and WebKit (L13 passes natively in Firefox, as the finding says). L9: field.script tracks edited controls (input/change) instead of comparing with the default: erase-after-edit shows valueMissing on blur, an untouched select or combobox Tabbed through does not. L10: a MutationObserver on `disabled` (controls, fieldsets, fields) hides the errors of a field whose controls are all disabled, the server's too. L11: the checkbox script restores `indeterminate` after a reset for checkboxes the server rendered indeterminate; the Checkbox component does it in islands (new afterFormReset helper in form/reset.ts). L13: Shift+Tab into a radio group with nothing checked moves focus to its first enabled radio. L14: Field counts parts by kind: a second Description or a second Error of the same match gets -2, -3; describedBy lists every Description; the script reads the match without the number. Recorded: L12 is TASK-458 (tri-state restore, disabled children, one count, aria-controls). L16 (SUSPECTED) is TASK-459 (repro first). L15 stays: without JavaScript a Description rendered after the control cannot be linked (the control's attributes are written first, as M26), and a server indeterminate checkbox is drawn mixed but exposed unchecked: `indeterminate` is a property, and ARIA in HTML advises against aria-checked on a native checkbox; the script fixes both once it runs. Docs: checkbox.md, radio-group.md, field.md.

2026-10-16 (Beacon): criteria: #1-#3, #5, #6 fixed with tests; #4 (L12) filed as TASK-458; #7 (L15) recorded as staying (no-JS limits, reasons above); #8 (L16) filed as TASK-459.
<!-- SECTION:NOTES:END -->
