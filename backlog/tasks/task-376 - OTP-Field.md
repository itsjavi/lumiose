---
id: TASK-376
title: OTP Field
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 01:28'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-365
priority: low
ordinal: 377000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. OTP Field: one-time code inputs with paste, autofill (autocomplete one-time-code) and form value.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [x] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [x] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [x] #4 A docs page with a type-checked example
- [x] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-16 (Halo): claimed (M12 seventh batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits e192545a, ab0fccb3, 7cd49fb4).

One input or one per character (decision recorded, decision-16): one native `<input type="text" autocomplete="one-time-code" inputmode maxlength minlength pattern>` holds the code, under aria-hidden visual slots. Autofill: Safari and Android Chrome offer an SMS code into one field, which per-character inputs (Base UI's approach) only receive through script that redistributes it, and `maxlength=1` per slot breaks without JS. Paste and Backspace and the arrow keys are a text field's own; `pattern`/`minlength`/`required` validate the whole code natively and the form submits it, without JavaScript. Screen readers meet one labelled field read as one value, instead of six fields each needing "digit 2 of 6". Cost: the slots are a picture drawn by the script, the input lies over them transparent (text, caret, selection), so a press on a slot needs the script to place the caret; without JS the input shows as a plain field (letter-spaced in the theme) and the slots hide (`:defined`).

Element `lu-otp-field` (script 1.24 kB brotli): cleans the value as it changes (validation-type numeric (default), alpha, alphanumeric, none; spaces dropped; clamped to `length`), with the caret kept after the same characters; a paste is cleaned before `maxlength` could cut it ("987 654 321" fills six slots); `valueinvalid` (detail.value) for refused characters; a full field types over the caret's character; a press on a slot moves the caret there; slots get text (dots with `mask`), `data-filled` and `data-active` (the caret's slot, while focused); `data-complete`, `data-filled`, `data-focused` on the element; `valuecomplete` once per completion (after other listeners), and `auto-submit` requests the form's submission; a form reset resyncs. Core CSS (0.20 kB): the input over the slots once defined, hidden slots until then (important, so a theme cannot show them without the script), `-webkit-text-security` for `mask`.

Base UI 1.9 comparison: same Root props (length, value, defaultValue, onValueChange, onValueComplete, onValueInvalid, validationType default numeric, inputMode, mask, autoComplete default one-time-code, autoSubmit, name, form, id = input id, required, disabled, readOnly) and the Separator (orientation). Parts differ: one `Input` plus `Slot`s instead of an `Input` per slot; the Separator is visual (aria-hidden). Not done: `normalizeValue` (a function cannot reach a server page's script), inputRef, render. Zag pin-input: per-character inputs like Base UI; its `otp` autocomplete only on the first.

doc-9: no section of its own; section 1 (isComposing-safe: the input event cleans, ids deterministic, no inline script) and section 15 (Field: the input takes the field's id, description, error; Field's script shows valueMissing and patternMismatch in Field.Error). Section 17: 2.1.1, 4.1.2 (one textbox with its value), 2.4.7 (the caret's slot ringed via data-active while focused, checked), 2.5.8 (the input covers the slots), 1.4.10/1.4.12 (slots shrink; reflow test), 3.3.1/3.3.2 with Field, axe light and dark, empty and filled.

Evidence: unit tests otp-field.test.tsx (server HTML, mask and types, Field), otp-field.script.dom.test.ts (cleaning, invalid, paste-like input, completion, overwrite, alpha+mask, auto-submit, value setter, reset), otp-field.types.test.tsx; ui-e2e e2e/otp-field.e2e.ts (no-JS validation and submission, keys, clipboard paste, press on a slot, Field validation, mask, reset, auto-submit, island with completion and refused input and no LUM warnings, axe light/dark, focus, target, reflow, per-page scripts). Docs: otp-field.md, README and theming rows, live demo otp-field-1. Screenshot: backlog/assets/task-376-otp-field.png.

Sizes (min/gzip/brotli kB): script 4.12/1.41/1.24; component JS 7.11/2.60/2.32; CSS 0.54/0.29/0.20.

New public names (TASK-400): `OTPField` (`Root`, `Input`, `Slot`, `Separator`), `OTPFieldRootProps`, `OTPFieldInputProps`, `OTPFieldSlotProps`, `OTPFieldSeparatorProps`, `OTPFieldValidationType`, element `lu-otp-field` (attributes `length`, `validation-type`, `mask`, `auto-submit`; property `value`; events `valuecomplete` and `valueinvalid` with `detail.value`; `data-complete`, `data-filled`, `data-focused`), slot hooks `data-slot`, `data-active`, `data-filled`, class `lu-otp-field`, entries `@lumiose/ui/otp-field`, `@lumiose/ui/otp-field.css`. The docs test's kebab helper (packages/cli, Beacon's) now keeps acronyms whole so `OTPField` maps to `otp-field`.

2026-10-16 (Halo): checks green: pnpm check (2348 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build rerun in full after fixes (676 passed, 22 skipped; the first run's 5 failures were this batch's: the per-page script checks of Popover, Tooltip and the hover/modal page missing the new shared hover chunk, and the Menu submenu hover test under the longer nav, fixed in the next commit), apps/web Playwright 171 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
OTP Field ships as one native `<input autocomplete="one-time-code" maxlength pattern>` under visual slots (decision and its a11y and autofill tradeoff recorded in the notes): autofill, paste, Backspace, the arrows, validation and the form value are native and work without JavaScript; `<lu-otp-field>` (1.2 kB brotli) shows the slots, keeps the code to the allowed characters, cleans pastes, types over in a full field, moves the caret to a pressed slot, and fires valuecomplete/valueinvalid with auto-submit. Unit, script, type and ui-e2e tests, docs page, rows and a live demo; pnpm check, pack smoke, full ui-e2e and apps/web green. Gap: normalizeValue. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
