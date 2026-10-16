---
id: TASK-459
title: >-
  Field: a sync validate with validationDebounceTime and a submit inside the
  window
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 13:20'
updated_date: '2026-10-16 21:36'
labels:
  - ui
  - forms
milestone: m-12
dependencies: []
priority: low
ordinal: 457000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the 0.1.0 release review, TASK-446 L16 (Prism, SUSPECTED). Field.Root's run() clears the control's custom validity and waits validationDebounceTime before calling validate, also when validate is synchronous; a submit inside that window then passes the browser's validation without the check. Confirm with a repro, then flush a pending synchronous check on a submit attempt (or run synchronous checks at once and debounce only the display).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A repro confirms or rules it out
- [x] #2 If confirmed, a submit within the debounce window is blocked by a failing synchronous validate, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the fix batch 2 merge. A follow-up from the release review, not needed for 0.1.0.

2026-10-16 (Halo): claimed (final M12 batch; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): confirmed and fixed. Repro: island fixture 'Promo code' (validationDebounceTime 1000, a synchronous validate refusing digits) in a form that counts its submits; typing 'ab1' then requestSubmit() at once (focus stays in the field, so no change event runs the check) submitted the form in dev, build, Firefox and WebKit. A click on a submit button was not affected (its blur's change runs the check at once). Fix in field.tsx: run() keeps the waiting check (due); a capturing submit listener on the field's form runs it at once; if the control is then invalid (a synchronous validate failed), it cancels the submission (preventDefault, stopImmediatePropagation) and calls the form's reportValidity(), so the field shows the error and takes focus. An async validate still does not block (as documented). e2e 'a submit within the window runs the check, and a failing one blocks it' fails without the fix in all four projects. field.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Confirmed: a submit inside the debounce window skipped a synchronous validate. The field now runs a waiting check on a submit attempt and blocks the submission when it fails; test in every engine.
<!-- SECTION:FINAL_SUMMARY:END -->
