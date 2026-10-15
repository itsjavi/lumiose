---
id: TASK-373
title: Progress and Meter
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-15 23:23'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: medium
ordinal: 374000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Progress (determinate and indeterminate) and Meter, with value CSS variables.
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
- Native `<progress>` and `<meter>` carry Base UI's API: the element is the `Track` part (no separate Indicator; the element draws the value). Parts Root (`<div>` with `--lu-value`, 0% to 100%), Label (`<label for>` the element), Value (`<span>`, or a render function), Track. No script, no CSS.
- Value text: default `Intl.NumberFormat` percent of the range; `format` (Intl options) formats the value itself; `getAriaValueText` for AT; `aria-valuetext` on the element.
- Progress: `value: number | null`; null is indeterminate (no `value` attribute, `:indeterminate`). Native progress has no `min`, so it gets `value - min` and `max - min`.
- In the browser, Progress.Track writes `value` through an effect, because `progress.value = undefined` throws in Chrome (the compiler writes `value` as a DOM property) and an island could not go back to indeterminate. The server renders the attribute. Follow-up for the runtime proposed in the report.
- Theme: bar edge in `--lu-input` (3:1 extent, 1.4.11), value in `light-dark(var(--lu-primary), #60a5fa)` (primary is under 3:1 on dark backgrounds), indeterminate sliding segment that stands still under prefers-reduced-motion (2.3.3).

Compared with Base UI 1.9 Progress/Meter: same Root props (value, min, max, format, locale, getAriaValueText) and parts Label/Track/Value; Indicator folded into the native element; data-complete/data-indeterminate replaced by `:indeterminate` and `--lu-value`; Meter's native `low`/`high`/`optimum` pass through on Track. Zag progress: same states; its circular variant is not covered (style the native element or draw from `--lu-value`).

doc-9: no section of its own; section 1 (ids deterministic, no script) and section 17 (4.1.2 roles progressbar/meter with values and valuetext, 1.4.11 bar edge, 1.4.1, 2.3.3 reduced motion, 1.4.10/1.4.12 reflow, axe light and dark on /progress and /progress/island) pass.

Evidence: unit tests progress/progress.test.tsx (server HTML incl. min offset, formats, indeterminate, meter bands); ui-e2e e2e/progress.e2e.ts (no-JS roles and text, island updates and back to indeterminate with no LUM warnings, axe light/dark, reduced motion, reflow, no script on the page). Docs: progress.md, meter.md, README and theming rows, live demos. Screenshot: backlog/assets/task-373-progress-meter.png.

Sizes (min/gzip/brotli kB): progress component JS 1.90/0.89/0.79, meter 1.77/0.84/0.75; no script, no CSS.

New public names (TASK-400): `Progress` (`Root`, `Label`, `Track`, `Value`), `ProgressRootProps`, `ProgressLabelProps`, `ProgressTrackProps`, `ProgressValueProps`, `Meter` (same parts), `MeterRootProps`, `MeterLabelProps`, `MeterTrackProps`, `MeterValueProps`, custom property `--lu-value`, classes `lu-progress`, `lu-meter`, entries `@lumiose/ui/progress`, `@lumiose/ui/meter`.

2026-10-16 (Halo): checks green: pnpm check (2264 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (441 passed; the 2 tooltip reflow failures came from the longer nav and were fixed in b930d799, tooltip suite 41 passed), apps/web Playwright 117 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Progress and Meter ship as native `<progress>` and `<meter>` (the Track part) with Label, Value, `--lu-value`, Intl formatting, getAriaValueText and an indeterminate progress (value null); no script, no CSS. The theme draws a 3:1-edged bar and a reduced-motion-aware indeterminate segment. Unit and ui-e2e tests (roles and value text without JS, island updates back to indeterminate, axe light/dark, reduced motion, reflow), docs pages, rows and live demos. Checks: pnpm check, pack:check --smoke --skip-npm, full ui-e2e and apps/web Playwright green. Runtime follow-up proposed: `progress.value = undefined` throws, worked around with an effect. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
