---
id: TASK-358
title: Combobox and Select
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 20:31'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
priority: high
ordinal: 359000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Combobox.Root (lu-combobox, form-associated), Label, Input (role="combobox"), List (role="listbox" popover), Item (role="option" data-value), with the value/label split (the input shows the label, value is data-value); then groups, empty and status states, clear, multiple with chips, validation, async options, and Select.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Combobox and Select follow their APG contracts and submit with forms
- [ ] #2 value/onValueChange and bind:value work with signals; the input shows the label
- [ ] #3 Keyboard-contract and axe tests pass
- [ ] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [ ] #6 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [ ] #7 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-15 (Halo): claimed (M12 third batch, branch claude/halo-m12c-4d6b9f).

2026-10-15 (Halo): implemented (commit ff9f5287 and the docs commit). Screenshots: [combobox](../assets/task-358-combobox.png), [select](../assets/task-358-select.png), [async combobox in an island, dark](../assets/task-358-combobox-island-dark.png).

## Select: native `<select>`, not the listbox pattern (technical decision, decision-16)

Select renders a native `<select>`, a customizable select (`appearance: base-select`) where the browser has it (Chrome/Edge 135, Safari 27 per caniuse, unverified here), the classic select elsewhere (Firefox). Reasons:
- **No JavaScript**: it works in server HTML with JS off, on every browser, and ships no script (Combobox needs 3.8 kB brotli). The listbox pattern would need its script for everything, including submitting a value.
- **Platform behaviour for free**: `role=combobox`, keyboard and typeahead, the anchored top-layer picker, Escape layering inside a dialog, forms (`name`, `required`, autofill, reset, disabled fieldset) and the mobile pickers: most of doc-9 section 7.
- **Browser support degrades well**: without customizable select it is still a full select, styled closed; the parser drops the Trigger and rich option content, so an island falls back to client rendering there (LUM4006 fallback, documented).
- **Base UI parity gaps, recorded in select.md**: no `open`/`onOpenChange`/`modal` (the platform fires no picker event; `:open` styles it), no `Label` part (`<label for>`; Field later), no `multiple` (Combobox has it), no `alignItemWithTrigger`, no scroll arrows, Enter does not open it (Space and arrows do, as on any select), no Popup/List/ItemText/ItemIndicator/GroupLabel/Icon parts (`::picker(select)`, `option::checkmark`, `::picker-icon` are the platform's; `Group` takes `label`).
The listbox pattern stays available as Combobox for long lists, multiple values and async options.

## Combobox design (technical, recorded here)

- Element contract: `lu-combobox`, form-associated (ElementInternals: `name`, `required` with the browser's own "select an item" message anchored at the input, reset, disabled fieldset, `formStateRestoreCallback`); properties `value` (string, or string[] with `multiple`), `open`, `name`, `required`, `disabled`, `multiple`; attribute `filter`; events `change` (bubbling, only on a user choice; the inner input's `change` stays inside) and `openchange` (`detail.open`).
- Parts are found by their ARIA wiring (input `role=combobox`, its `aria-controls` listbox, the popover around it), the chips and empty state by ids derived from the root's (`<id>-chips`, `<id>-empty`), and the buttons are invoker commands with custom commands `--toggle` and `--clear` (`commandfor` = the element). No part attribute (decision-62).
- Value/label split: options carry `data-value` and optional `data-label`; the input shows the label. The server cannot put the label in the input (the Input renders before the options), so the script fills it on upgrade; without JavaScript the input is empty (documented).
- Multiple: chips are rendered by the script (it knows the labels), so server pages need no island; each value is its own FormData entry.
- Async options: `filter="none"`; a MutationObserver (only after the server selection is read) gives new options the selection and current search, and opens the popup when results arrive while the user types. A chosen value keeps its label after its option is gone.
- Generic `Root<Multiple>` types `value`/`onValueChange`/`bind:value` as `string` or `string[]` from `multiple` (type test in combobox.types.test.tsx).

## doc-9 results

Section 1 (cross-cutting), for Combobox: [x] Escape/outside press act on the topmost layer only (shared layer stack; e2e: in a dialog Escape closes the list, then the dialog). [x] Outside-press filters: main button only (e2e: right-click keeps it open), primary pointer only, no scrollbar presses, no removed targets, presses inside the popup box. [x] Dismissal on release, not press. [x] Focus never leaves the input (pointerdown preventDefault in the popup and on the buttons), so the macOS button-focus race does not apply. [x] Popups render inside their dialog (DOM). [x] Zero-delta pointermove ignored. [x] isComposing guard on Enter/arrows. [x] Deterministic ids (root id + value); `aria-labelledby` only when a Label/GroupLabel renders; `aria-activedescendant` only while an option is highlighted. [x] Closed in server HTML. [x] RTL: logical placement; no horizontal arrow keys in the pattern. [ ] VoiceOver's live-region delay: Empty and Status are `role=status` but get no Word Joiner mutation yet (follow-up). [ ] Scroll lock: N/A (non-modal). Note: Safari lacks `closedby`, and Dialog's fallback light dismiss tests the dialog's box, so a click on a combobox list that overflows a dialog could close the dialog in Safari (follow-up, not verifiable in Chromium).
Section 6 (Combobox): [x] role/aria-expanded/aria-controls/aria-autocomplete=list/aria-activedescendant, focus kept. [x] IME (code; not e2e). [x] Escape closes without committing; closed, it bubbles (dialog test). [x] Tab closes. [x] Closing without a choice restores the label. [x] Clearing the text clears a single selection. [x] Reopening highlights the first selected option. [~] Status/empty announced: `role=status` (see VoiceOver note). [x] Autofill cannot commit: `autocomplete=off`, typing never commits (real autofill not tested). [x] Multiple: one entry per value (e2e: `tags=ui&tags=bug`). [x] No native equivalent: documented.
Section 7 (Select, native): [x] role=combobox; a label click focuses without opening (e2e). [x] Keyboard opening focuses the selected option (e2e). [~] Closed-control typeahead and drag-to-select: native, platform-dependent, not tested. [x] Forms: name, required (e2e), reset (e2e), autofill and fieldset native. [x] In a dialog, Escape closes the picker, then the dialog (e2e). [x] Customizable select gaps documented.
Section 17 (WCAG 2.2 AA): axe with the A/AA tags passes closed and open, light and dark, on /combobox (single open, empty state, multiple open), /combobox/island (closed, open), /select (closed, picker open) and /select/island, plus inside the dialog. Manual: [x] 2.1.1/2.1.2 every action by keyboard, Tab leaves both. [x] 2.4.3 focus stays in the input / returns to the select. [x] 2.4.7 2px ring on the input, the select and its options; the highlighted option draws the ring (e2e). [x] 2.4.11 the popup opens beside the input, never over it. [x] 2.5.3 the input's name is its visible label; the icon buttons have no visible text. [x] 2.5.8 buttons, chips, options and the select >= 24px (e2e; the select's inner button takes the padding). [x] 1.4.10/1.4.12 field and popup within 320px with text spacing (e2e). [x] 1.4.1 selected options carry a ✓ (and option::checkmark). [x] 1.4.3/1.4.11 theme pairs reuse the audited tokens (input border --lu-input 3:1; chips --lu-secondary-foreground on --lu-secondary). [x] 3.3.1/3.3.2 required is reported by the browser at the input, `aria-invalid` set after a failed submit (e2e). [x] 3.2.2 choosing never submits (Enter on a highlighted option is consumed). [~] 4.1.3 see VoiceOver note. Not checked: screen readers, 200% zoom, forced colours, Firefox and WebKit.

## Against Base UI (1.9) and Zag

- Base UI Combobox: same anatomy where the platform allows (Root, Label, Input, Trigger, Clear, Chips, Popup, List, Item, Group, GroupLabel, Empty, Status); dropped Portal/Positioner/Backdrop/Arrow (top layer and anchor positioning), Value/Icon/ItemIndicator/Row/Collection/Separator (theme draws marks from `[aria-selected]`), `items`/`itemToStringLabel` (options are markup; labels from text or `label`). Behaviour matched: opens on input click, Arrow Down/Up open on the selected option, highlight loops through the input, Escape restores, emptying clears, `filter={null}` ≈ `filter="none"`, multiple keeps the popup open and clears the search, Backspace removes the last chip, right-click outside ignored. Different: arrow keys skip disabled options (as Zag); no `autoHighlight`, `openOnInputClick`, `loopFocus`, `limit`, `virtualized` props yet.
- Zag combobox: same ARIA; Zag's `allowCustomValue`, `inputBehavior: "autocomplete"` (inline completion) and `selectionBehavior` are not offered (free text belongs to Base UI's Autocomplete, a separate parity task).
- Base UI / Zag Select: see the Select section above.

## New public names (for the user's review; beyond decision-62)

Combobox parts `Trigger`, `Clear`, `Chips`, `Popup`, `Group`, `GroupLabel`, `Empty`, `Status` (Base UI's names); props `multiple`, `filter` (`"contains" | "startsWith" | "none"`), `name`, `required`, `disabled`, `open`/`onOpenChange`/`bind:open` on Root, `label`/`disabled` on Item, `removeLabel` on Chips; type `ComboboxValue`; custom commands `--toggle`, `--clear`; element attribute `filter`, `data-remove-label` on the chips list; ids `<id>-chips`, `<id>-empty`. Select parts `Root`, `Trigger`, `Value`, `Item`, `Group` (`label`), `Separator`. Theme classes `lu-combobox`, `lu-select`. Exports `/combobox`, `/combobox.css`, `/select`, `/select.css`.

## Sizes (brotli, `pnpm --filter @lumiose/ui size`)

Combobox client script 3.76 kB (11.63 min / 4.21 gzip), component JS 5.22 kB, CSS 0.40 kB. Select: no script, component JS 0.55 kB, CSS 0.08 kB. Theme 2.29 kB (all components).

## Follow-ups (proposed, not created: Lux files them)

- VoiceOver live-region delay for Empty/Status (doc-9 section 1): a Word Joiner mutation as Base UI's useInitialLiveRegionTextMutation.
- Dialog's Safari `closedby` fallback tests the dialog's box: a press on a top-layer popup that overflows the dialog (combobox list, menu) counts as outside. Test with WebKit.
- Combobox `autoHighlight`, `openOnInputClick`, `limit` props for parity; a `Separator` part.
- Firefox/WebKit runs of the combobox and select suites (TASK-361's test kit).
<!-- SECTION:NOTES:END -->
