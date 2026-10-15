---
id: TASK-372
title: Slider
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:54'
updated_date: '2026-10-15 23:23'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-365
priority: medium
ordinal: 373000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Slider with one or more thumbs, keyboard steps, RTL, form value and CSS variables for positions.
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

2026-10-16 (Halo): implemented (commits bc8f6f3d, 603e02a7, 8cd76ad4, 22882057, a918f3f9, 237e8f92).

Design (technical decisions, decision-16):
- Each Thumb is a native `<input type="range">` (min, max, step, value, name, form, disabled): dragging, arrows, Home/End, RTL, vertical, clamping and rounding, submission and reset are the platform's, in server HTML and without JavaScript. Thumbs stack over the Track/Indicator divs in one grid cell (slider.css, lu.core: 0.31 kB brotli); over a Track the inputs' own tracks are transparent; vertical thumbs use `writing-mode: vertical-lr; direction: rtl` (bottom to top); with two thumbs only the thumb pseudo-elements take the pointer.
- `<lu-slider>` (script 1.49 kB brotli) adds what the platform lacks: Page Up/Page Down and Shift+arrow by `large-step` (RTL and vertical aware); ranges kept in order and `min-steps-between-values` apart, pushing the neighbour (`thumb-collision-behavior` push, default) or stopping at it (`none`); a press on a range's track moves the nearest thumb (mapped with the native thumb inset), focuses it and drags it with pointer capture (primary pointer, main button, one pointer id; disabled thumbs excluded); `--lu-slider-start`/`--lu-slider-end`, `aria-valuetext` (with `format`) and the `<output for>` Value text kept current, also after a form reset.
- `Root` is generic over the value (`number` or `number[]`), so `bind:value` infers a single or a range slider; `onValueCommitted` on `change`.
- Thumbs of a range need an `aria-label` that contains the visible label's text (2.5.3), documented; fixtures follow it.
- `swap` collision and `thumbAlignment` are not supported (native thumbs stay inside the track, Base UI's "edge"): recorded as a parity gap.
- Control uses `touch-action: pan-y` (`pan-x` vertical) instead of `none`, so the page still scrolls across a slider on touch; native thumbs handle their own touch drags.

Verified in Chromium: in RTL, Arrow Left raises a native range (and our Shift+Arrow Left matches); vertical thumbs take Arrow Up; Home/End native.

Compared with Base UI 1.9 Slider: same Root props (value, defaultValue, onValueChange, onValueCommitted, min, max, step, largeStep, minStepsBetweenValues, thumbCollisionBehavior push|none, orientation, disabled, name, form, format, locale) and parts (Label, Value, Control, Track, Indicator, Thumb); no hidden input/inputRef/getAriaLabel (aria-label per Thumb), no swap, no thumbAlignment. Zag slider: same keyboard and range rules (minStepsBetweenThumbs, push); its `origin` (center/end) is not covered.

doc-9 section 14: keys (arrows step, PageUp/PageDown and Shift+arrow largeStep, Home/End, clamp/round), aria-valuetext formatter and per-thumb aria-label, push/none and min steps, focus moves without validation, track press moves the nearest thumb, disabled thumb not draggable, one pointer id, RTL inverted axis, form submits clamped values: pass. Gaps: swap, thumb alignment `contain`, touch-action pan (deliberate). Section 1: RTL arrows, isComposing ignored, deterministic ids, no inline scripts (CSP: inline `style` attributes carry the custom properties, as placement does). Section 17: 2.5.7 (every drag has the keys, and a single press works), 2.1.1, 2.4.7 (ring around the thumb, checked by screenshot diff), 2.5.8 (24px thumbs), 1.4.11 (track edge in --lu-input, thumbs edged in the primary colour), 2.5.3, 1.4.10/1.4.12 (reflow test), axe light and dark on /slider and /slider/island.

Evidence: unit tests slider/slider.test.tsx (server HTML), slider.script.dom.test.ts (push, none, ends, large step, value text, reset), slider.types.test.tsx (bind:value inference); ui-e2e e2e/slider.e2e.ts (no-JS keys and form submission, keyboard contract, push, none, track press, mouse drag incl. push, vertical, RTL, reset, island bind:value and onValueCommitted with no LUM warnings, axe light/dark, focus, targets, reflow, the page loads only slider.script). Docs: slider.md, README and theming rows, live demo slider-1. Screenshots: backlog/assets/task-372-slider.png, task-372-slider-dark.png.

Sizes (min/gzip/brotli kB): script 4.26/1.71/1.49; component JS 8.22/3.20/2.87; CSS 1.28/0.40/0.31.

New public names (TASK-400): `Slider` (`Root`, `Label`, `Value`, `Control`, `Track`, `Indicator`, `Thumb`), `SliderValue`, `SliderRootProps`, `SliderLabelProps`, `SliderValueProps`, `SliderControlProps`, `SliderTrackProps`, `SliderIndicatorProps`, `SliderThumbProps`, element `lu-slider` (attributes `large-step`, `min-steps-between-values`, `thumb-collision-behavior`, `format`, `locale`; property `value`), custom properties `--lu-slider-start`, `--lu-slider-end`, class `lu-slider`, entries `@lumiose/ui/slider`, `@lumiose/ui/slider.css`.

2026-10-16 (Halo): checks green: pnpm check (2264 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (441 passed; the 2 tooltip reflow failures came from the longer nav and were fixed in b930d799, tooltip suite 41 passed), apps/web Playwright 117 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slider ships with native range inputs as thumbs (drag, arrows, Home/End, RTL, vertical, submission and reset without JS) and `<lu-slider>` (1.5 kB brotli) for Page Up/Down and Shift+arrow by largeStep, ranges kept in order and apart (push or none), nearest-thumb track presses with drag, value text and the Indicator's `--lu-slider-start`/`--lu-slider-end`; bind:value infers number or number[]. Unit, script, type and ui-e2e tests (keyboard contract, push/none, track press, drag, vertical, RTL, reset, island, axe light/dark, focus, targets, reflow), docs page, rows and a live demo. Checks: pnpm check, pack:check --smoke --skip-npm, full ui-e2e and apps/web Playwright green. Gaps recorded: swap collision and thumbAlignment. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
