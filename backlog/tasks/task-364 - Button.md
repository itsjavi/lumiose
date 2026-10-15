---
id: TASK-364
title: Button
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
ordinal: 365000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Button with focusable-when-disabled and native button semantics, the base other parts render through.
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

2026-10-16 (Halo): claimed (M12 fifth batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits bc8f6f3d, 603e02a7, 8cd76ad4, 22882057, a918f3f9).

Design (technical decisions, decision-16):
- `Button` is a native `<button type="button">` (type defaults to button so it never submits by accident); every native prop passes through (`command`, `commandfor`, `popovertarget`, `form`).
- `focusableWhenDisabled` with `disabled` renders `aria-disabled="true"` instead of `disabled`, so focus stays (a loading state). button.script.ts (0.10 kB brotli) cancels clicks, Enter and Space on `button[aria-disabled='true']:not([role])` in the capture phase on `document`, before Lumiose's handlers and the form's default action. Buttons with a role (tabs, menu items) are their widgets' to handle.
- Without the script an aria-disabled button still acts: documented, and server pages should use plain `disabled`.

Compared with Base UI 1.9 Button: same `focusableWhenDisabled` semantics and data attributes replaced by native `:disabled` / `[aria-disabled]`; no `nativeButton`/`render` (always a `<button>`). Zag has no button machine.

doc-9: section 1 items that apply pass (isComposing N/A: no key handling of its own; ids N/A). Section 17: 2.1.1 (Enter/Space/Tab), 2.4.3, 4.1.2 (aria-disabled announced), 3.2.2, 2.4.7 (2px ring, also on aria-disabled), 2.5.8 (36px), 1.4.3 via axe, all checked; axe light and dark on /button and /button/island pass.

Evidence: unit tests button/button.test.tsx (server HTML) and button.script.dom.test.ts; ui-e2e e2e/button.e2e.ts (no-JS submission, focus order skipping disabled, focusable aria-disabled cancels click/Enter/Space, island signal flow with no LUM warnings, axe light/dark, focus ring, target size, the page loads only button.script). Docs: packages/ui/docs/button.md, README row, theming row (`lu-button` on `Button`), live demo apps/web/src/ui-demos/button-1.tsx. Screenshot: backlog/assets/task-364-button.png.

Sizes (min/gzip/brotli kB): client script 0.16/0.16/0.10; component JS 0.60/0.38/0.30; no CSS.

New public names (TASK-400): `Button`, `ButtonProps`, `focusableWhenDisabled`, entry `@lumiose/ui/button`.

2026-10-16 (Halo): checks green: pnpm check (2264 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (441 passed; the 2 tooltip reflow failures came from the longer nav and were fixed in b930d799, tooltip suite 41 passed), apps/web Playwright 117 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Button ships as a native `<button type="button">` with `focusableWhenDisabled` (aria-disabled plus a 0.1 kB brotli script that cancels its clicks, Enter and Space). Unit, script and ui-e2e tests (keyboard, no-JS, island, axe light/dark, focus, targets, per-page script), docs page with a type-checked example, README/theming rows and a live demo. Checks: pnpm check, pack:check --smoke --skip-npm, full ui-e2e (dev and build) and apps/web Playwright green. Without the script an aria-disabled button still acts (documented). New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
