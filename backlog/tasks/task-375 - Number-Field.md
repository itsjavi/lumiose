---
id: TASK-375
title: Number Field
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 00:22'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-365
priority: medium
ordinal: 376000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Number Field with increment and decrement, scrubbing, formatting with Intl, min/max/step and form value.
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

2026-10-16 (Halo): claimed (M12 sixth batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits 546267d3, 0d478821, 6af596af).

Native vs text input (decision recorded, decision-16): without `format`, the Input is a native `<input type="number" inputmode="decimal" min max step>`: typing, the arrow keys, range and step validation, mobile keypads and the submitted number are the browser's, with no JavaScript. A native number input cannot show grouping, a currency or a percentage and parses typed text its own way, so with `format` (Intl.NumberFormat options) the Input is an `<input type="text" role="spinbutton" aria-valuenow/min/max/valuetext>` showing the formatted number, and Root renders an `<input type="hidden">` that submits the number; the element moves the `name` from the text input to the hidden one when it connects, so without JavaScript a formatted field submits its text as typed (documented: leave `format` out for forms that must work without JS). Parsing (number-field/format.ts) reads the locale's decimal sign and digits from Intl, skips grouping, currency, unit and spaces, takes minus signs and parentheses, and divides percentages.

Element `lu-number-field` (script 2.18 kB brotli): Arrow Up/Down by `step` (handled by the element in both modes, so stepping is identical), Shift+Arrow and Page Up/Down by `large-step` (10), Home/End to min/max; buttons `[data-action=increment|decrement]` step once on press and repeat after 400 ms every 60 ms (pointer capture, window pointerup, stop when the button disables at the range end), a keyboard/AT click steps once, buttons are tabindex -1 with aria-label Increase/Decrease and aria-controls, disabled at the ends; `[data-scrub]` area steps per `data-pixel-sensitivity` px (horizontal or vertical) with `data-scrubbing`; the wheel steps only with `allow-wheel-scrub` while the input is focused and hovered, and Chromium's native stepping of a focused number input is cancelled otherwise (measured in Playwright: Chromium does step natively); commit (`change`, Enter) clamps unless `allow-out-of-range`, formats, and restores the last value for unreadable text; `input` and `change` fire on the input for every element change; form reset resyncs the hidden input. Core CSS (0.20 kB brotli): native spinners hidden once `:defined`, buttons hidden until then (no-JS), held buttons no selection/callout, scrub cursor and `touch-action: none`.

Base UI 1.9 comparison: same Root props (value number|null, defaultValue, onValueChange, onValueCommitted, min, max, step, largeStep, format, locale, allowWheelScrub, allowOutOfRange, name, form, id = input id, required, disabled, readOnly) and parts (Group, Input, Increment, Decrement, ScrubArea with direction and pixelSensitivity). Not done: `smallStep` (Alt+Arrow) and `snapOnStep` (a native field validates against `step` itself), ScrubAreaCursor (pointer lock), inputRef, render; `step="any"`. Zag number-input: same spinbutton keys; its `spinOnPress` and `clampValueOnBlur` match ours by default.

doc-9: no section of its own. Section 1: ids deterministic, isComposing ignored, no inline scripts. Section 17: 2.1.1 (all actions from the keyboard; buttons are pointer conveniences), 2.5.7 (the scrub drag has the arrow keys), 4.1.2 (native spinbutton, or role=spinbutton with value/min/max/valuetext kept current), 2.4.7 (ring on the group via :focus-within), 2.5.8 (36px buttons), 1.4.10/1.4.12 (reflow test), 3.2.2 (no submission on input), axe light and dark on /number-field and /number-field/island (axe "needs review" only for the "−" glyph buttons' colour contrast: their names are aria-labels).

Evidence: unit tests number-field.test.tsx (server HTML native/formatted/Field, parseNumber incl. de-DE, percent, ar-EG digits), number-field.script.dom.test.ts (keys, limits, hold, clamp, formatting and hidden input, wheel, reset), number-field.types.test.tsx; ui-e2e e2e/number-field.e2e.ts (no-JS stepping and submission, keyboard contract, clamping, hold, formatted parsing and submission, wheel only focused, scrub, reset, island with no LUM warnings, axe light/dark, focus, targets, reflow, per-page scripts). Docs: number-field.md, README and theming rows, field.md, live demo number-field-1. Screenshots: backlog/assets/task-375-number-field.png, task-375-number-field-dark.png.

Sizes (min/gzip/brotli kB): script 6.87/2.41/2.18; component JS 10.78/3.88/3.50; CSS 0.60/0.27/0.20.

New public names (TASK-400): `NumberField` (`Root`, `Group`, `Input`, `Increment`, `Decrement`, `ScrubArea`), `NumberFieldRootProps`, `NumberFieldGroupProps`, `NumberFieldInputProps`, `NumberFieldIncrementProps`, `NumberFieldDecrementProps`, `NumberFieldScrubAreaProps`, element `lu-number-field` (attributes `min`, `max`, `step`, `large-step`, `format`, `locale`, `allow-wheel-scrub`, `allow-out-of-range`; property `value`; `data-scrubbing`), part hooks `data-action="increment|decrement"`, `data-scrub`, `data-direction`, `data-pixel-sensitivity`, class `lu-number-field`, entries `@lumiose/ui/number-field`, `@lumiose/ui/number-field.css`.

2026-10-16 (Halo): checks green: pnpm check (2298 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (559 passed; the 4 failures were this batch's: two per-page script checks missing the shared layer/place chunks and the Select picker flipping under the longer nav, fixed in the next commit, 70 passed on rerun), apps/web Playwright 125 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Number Field ships: a native `<input type="number">` without `format` (works and submits without JavaScript), or with Intl `format` a text spinbutton plus a hidden input that submits the number (the native-vs-text decision is recorded in the notes). `<lu-number-field>` (2.2 kB brotli) adds the large step, Home and End, press-and-hold buttons, a scrub area, the wheel only with allowWheelScrub while focused, and commit-time clamping and formatting. Unit, script, type and ui-e2e tests, docs page, rows and a live demo; pnpm check, pack:check --smoke --skip-npm, full ui-e2e and apps/web Playwright green. Gaps: smallStep, snapOnStep, ScrubAreaCursor. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
