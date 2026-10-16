---
id: TASK-446
title: 'Release review, Low: Field and Checkbox'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 12:34'
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
- [ ] #1 L9: Field: dirty means edited
- [ ] #2 L10: An error stays after its control becomes disabled.
- [ ] #3 L11: Checkbox indeterminate is lost on form reset (3 engines).
- [ ] #4 L12: Parent checkbox:
  - no tri-state restore;
  - disabled children ignored;
  - the server and the script count differently;
  - no `aria-controls`.
- [ ] #5 L13: Radio Group with nothing checked: Shift+Tab lands on the last radio in Chromium and WebKit.
- [ ] #6 L14: Two Descriptions, or two Errors with the same match, share one id, so one is read twice.
- [ ] #7 L15: No JS:
  - a Description after the control is not linked;
  - a server indeterminate or parent checkbox is exposed as unchecked while drawn mixed.
- [ ] #8 L16: SUSPECTED: sync `validate` with `validationDebounceTime` lets a submit inside the window bypass it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).
<!-- SECTION:NOTES:END -->
