---
id: TASK-369
title: Toggle and Toggle Group
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
priority: medium
ordinal: 370000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Toggle (aria-pressed) and Toggle Group (single and multiple, roving focus).
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

2026-10-16 (Halo): implemented (commits bc8f6f3d, 8cd76ad4, 22882057, a918f3f9, 237e8f92).

Design (technical decisions, decision-16):
- `Toggle` is a native `<button type="button" aria-pressed>`. On its own the component holds the state (an island; `bind:pressed`, `pressed`/`defaultPressed`/`onPressedChange`). A standalone Toggle on a server page has no script and stays as rendered: documented (its state only matters to your code; for form values use Checkbox or Switch).
- `ToggleGroup` renders `<lu-toggle-group role="group" data-orientation>` (light DOM, decision-62). Its script (0.83 kB brotli) presses the toggles on server pages and in islands: a click (pointer, Enter, Space) fires a cancelable bubbling `pressedchange` (`detail.pressed`) on the toggle, then flips `aria-pressed`; single mode releases the others; `valuechange` on the group; `value` property (string[]) and `multiple` attribute.
- Roving focus: one `tabindex="0"` (server HTML: first pressed, else first enabled; then the last focused), arrows along `data-orientation`, horizontal arrows swapped in RTL (computed `direction`), Home/End, looping unless `data-loop-focus="false"`; disabled toggles are native `disabled` and skipped; ignores isComposing and modifier keys.
- Pressed state in the theme is a filled surface plus a bar along the bottom edge, so it is not colour alone (1.4.1).

Compared with Base UI 1.9 ToggleGroup/Toggle: same props (`value: string[]`, `defaultValue`, `onValueChange`, `multiple`, `orientation`, `loopFocus` default true, `disabled`; Toggle `pressed`, `defaultPressed`, `onPressedChange`, `value`); cancel via `pressedchange.preventDefault()` instead of eventDetails.cancel(); no `render`. Zag toggle-group: `deselectable` (we always allow deselect, as Base UI), `rovingFocus` (always on).

doc-9 section 13: aria-pressed, label that does not change (docs advice), cancelable change, role=group with roving tabindex, arrows and Home/End follow orientation, single/multiple, deselect, disabled: all pass. Section 1: RTL arrows swap, isComposing ignored, deterministic markup. Section 17: 2.1.1/2.1.2 (Tab leaves the group), 2.4.3, 4.1.2, 1.4.1, 2.4.7, 2.5.8, 1.4.10/1.4.12 (reflow test at 320px), axe light and dark on /toggle and /toggle/island.

Evidence: unit tests (button/button.test.tsx toggle part, toggle-group.script.dom.test.ts, toggle-group.dom.test.tsx, slider/slider.types.test.tsx types); ui-e2e e2e/toggle.e2e.ts (single/multiple, keyboard contract incl. loop, vertical no-loop with a disabled item, RTL, island bind:pressed and bind:value with no LUM warnings, axe light/dark, focus ring, targets, non-colour pressed cue, reflow, the page loads only toggle-group.script). Docs: toggle.md, toggle-group.md, README and theming rows, live demos toggle-1/toggle-group-1. Screenshots: backlog/assets/task-369-toggle-group.png, task-369-toggle-group-dark.png.

Sizes (min/gzip/brotli kB): toggle component JS 1.15/0.60/0.53 (no script); toggle-group script 2.17/0.97/0.83, component JS 3.08/1.36/1.20; no CSS.

New public names (TASK-400): `Toggle`, `ToggleProps`, `ToggleGroup`, `ToggleGroupProps`, `loopFocus`, element `lu-toggle-group` (property `value`, attribute `multiple`, `data-orientation`, `data-loop-focus`), events `pressedchange` (`ToggleChangeDetail { pressed }`) and `valuechange`, classes `lu-toggle`, `lu-toggle-group`, entries `@lumiose/ui/toggle`, `@lumiose/ui/toggle-group`.

2026-10-16 (Halo): checks green: pnpm check (2264 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (441 passed; the 2 tooltip reflow failures came from the longer nav and were fixed in b930d799, tooltip suite 41 passed), apps/web Playwright 117 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Toggle (`<button aria-pressed>`, bind:pressed) and ToggleGroup (`<lu-toggle-group role="group">`, 0.8 kB brotli script) ship: single or multiple, deselect, cancelable `pressedchange`, `valuechange`, roving tab stop with arrows by orientation (swapped in RTL), Home/End, loopFocus, disabled skipped; pressed shown by shape in the theme. Unit, script, island and ui-e2e tests (keyboard contract, RTL, vertical, axe light/dark, focus, targets, reflow), docs pages, rows and live demos. Checks: pnpm check, pack:check --smoke --skip-npm, full ui-e2e and apps/web Playwright green. A standalone Toggle needs an island (documented). New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
