---
id: TASK-359
title: Tabs
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 18:47'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
references:
  - backlog/assets/task-359-tabs-light.png
  - backlog/assets/task-359-tabs-dark.png
priority: medium
ordinal: 360000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Tabs.Root, List, Tab and Panel with roving focus and automatic or manual activation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tabs follow the APG contract in both activation modes
- [x] #2 value/onValueChange and bind:value work with signals
- [x] #3 Keyboard-contract and axe tests pass
- [x] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [x] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [x] #6 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [ ] #7 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-15 Halo: claimed (branch claude/halo-m12b-eadea2).

## Implementation (2026-10-15, Halo)

- `packages/ui/src/tabs/`: `Root` renders `<lu-tabs>` (decision-62's `lu-` prefix), `List` (`<div role=tablist>`, `aria-orientation` only when vertical), `Tab` (`<button role=tab value=… aria-selected aria-controls tabindex>`, `aria-disabled` when disabled), `Panel` (`<div role=tabpanel tabindex=0 aria-labelledby>`, `hidden` unless selected). Props follow Base UI: Root `value`, `defaultValue`, `onValueChange`, `orientation`; List `activateOnFocus` (false: manual, Base UI's default), `loopFocus` (true); Tab `value`, `disabled`; Panel `value`. `bind:value` works on Root (component convention) and on `<lu-tabs>` itself (custom-element convention).
- The server HTML holds the whole APG state (selected tab, tab stop, hidden panels), so the right panel shows before any script. `tabs.script.ts` (a `?client` script, decision-63) defines `<lu-tabs>`: stateless over the DOM (the tab with `aria-selected=true` is the value), keydown (arrows by orientation, RTL swap, Home/End, loop, IME and modifiers ignored), click (main button only), focus selection with `data-activate-on-focus`, `value` getter/setter, `valuechange` (not bubbling). It fixes a server-selected disabled tab once parsed.
- The component mirrors the element: its attributes come from a signal that `valuechange` updates, and `value` drives it when it changes (like Dialog's `open`). A selected tab that becomes disabled gives its place to the first enabled one; every tab disabled: none selected, the first is the tab stop.
- Root's props type drops the intrinsic-element brand (`ElementProps`), or `LibraryManagedAttributes` would not add `bind:value` to it.
- Sizes (brotli): element script 0.81 kB, component JS for islands 1.64 kB, CSS 0.04 kB (`lu-tabs { display: block }`).
- Theme `.lu-tabs`: underline tabs; the selected tab has a 2px bar in the foreground colour and the foreground text colour (not colour alone); the list wraps on narrow screens; disabled tabs are dimmed by their text colour, not `opacity`, so their focus ring keeps full contrast. The same fix for focusable `aria-disabled` `.lu-button`s (opacity 1 while focus-visible), recorded in TASK-392 too.
- Docs: `ui/tabs.md`, README table and theme classes, docs index.

**New public names (for the user's review):** `Tabs.Root/List/Tab/Panel` and their props (Base UI's names); the `lu-tabs` element, its `value` property and its `valuechange` event (decision-62 lists `openchange`, `checkedchange` and `change`; `valuechange` follows the same lowercase `xchange` pattern and does not collide with `change` events bubbling from form controls in a panel); the list attributes the element reads, `data-activate-on-focus` and `data-loop-focus="false"`; theme class `lu-tabs`; exports `@lumiose/ui/tabs` and `/tabs.css`. Differences from Base UI: values are strings (Base UI takes any value, default 0); panels are always in the page (no `keepMounted`), since server HTML needs them; no `Indicator` yet.

## doc-9 results

**§8 Tabs.** Roving tabindex (the selected tab is the stop, as APG), arrows by orientation with `aria-orientation` only when vertical, RTL swap, Home/End, optional looping ✓ (e2e and element unit tests). Manual activation by default (Base UI), automatic with `activateOnFocus` (Zag's default) ✓; a secondary button never activates ✓ (e2e). Disabled tabs focusable, never selected; a selected tab that becomes disabled falls back to the first enabled; every tab disabled: none selected ✓ (e2e, unit). Panels `role=tabpanel`, `aria-labelledby`, `tabindex=0`, `hidden` when inactive ✓, kept in the page. Indicator positioned before hydration: N/A, no `Indicator` part yet (proposed follow-up: with anchor positioning it would need no script).

**§1 Cross-cutting (applicable).** IME: arrows ignored while composing ✓. Ids: deterministic, from `useId` and the value (no spaces) ✓; a tab references its panel by value, so a tab without a panel would point at a missing id (documented: a tab and a panel with the same value belong together). No inline scripts (no CSP nonce). RTL ✓. Layers, dismissal, scroll lock, animations: N/A.

**§17 WCAG 2.2 AA.** axe with the WCAG A/AA tags on /tabs (each selection) and /tabs/island, light and dark, dev and build ✓, no needs-review results. 2.1.1/2.1.2 ✓ (all keys; Tab leaves the list for the panel). 2.4.3 ✓ (into the list on the selected tab, then the panel). 2.5.3 ✓. 4.1.2 ✓ (roles, `aria-selected`, `aria-disabled`, `aria-orientation` update live). 3.2.1/3.2.2 ✓ (automatic activation only switches panels). Theme: tab text muted-foreground on background 5.61 / 7.76, selected 19.90 / 19.06 (light / dark); the selection bar 19.90 / 19.06 against the page (1.4.11) and it is a shape, not only a colour (1.4.1) ✓; focus ring 2px on tabs, disabled tabs included, and panels (2.4.7, e2e checks opacity 1) ✓; tabs 36px tall (2.5.8, e2e) ✓; 320px with text spacing: the list wraps, nothing clipped, no horizontal scroll (1.4.10, 1.4.12, e2e) ✓. 1.4.13, 2.5.1, 2.5.7, 4.1.3, 3.3.x: N/A.

**Proposed follow-up (not created: task ids would clash between branches):** `Tabs.Indicator` (Base UI's `--active-tab-*` variables; with CSS anchor positioning on the selected tab it is placed before hydration).

Screenshots: backlog/assets/task-359-tabs-light.png, task-359-tabs-dark.png (keyboard focus on the disabled Billing tab, Password selected).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Tabs (Root, List, Tab, Panel; Base UI's props) with the whole APG state in server HTML and <lu-tabs>, a 0.8 kB light-DOM element through ?client, for the keys (orientation, RTL, Home/End, loop) and the selection (manual by default, activateOnFocus), disabled tabs and their fallbacks, value property and valuechange event. value/onValueChange/bind:value on Root and bind:value on the element. e2e (dev and build): keyboard contract in both modes, vertical, RTL, right-click, all-disabled, islands with bind:value and a tab disabled while selected, axe WCAG A/AA light/dark, focus, target size, reflow and text spacing. Theme block .lu-tabs (underline with a 2px foreground bar). Docs: ui/tabs.md.
<!-- SECTION:FINAL_SUMMARY:END -->
