---
id: TASK-377
title: Autocomplete
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 00:22'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-358
priority: medium
ordinal: 378000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Autocomplete: free-text input with suggestions, after Combobox (TASK-358), sharing its list and keyboard model.
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

2026-10-16 (Halo): implemented (commits 34d29559, 0d478821, 6af596af).

Design (decision-16): Autocomplete reuses Combobox's element and parts. `lu-combobox` gets a `free` mode (combobox.script.ts, 4.10 kB brotli now, +0.3): the input itself has the name and submits the text (the element submits nothing and is always valid; Field's script takes the input as the control), typing filters (contains/startsWith) and opens the list, an empty input closes it, nothing has to be chosen, choosing (Enter on the highlighted option, a click) fills the option's `value` in and fires `input` and `change` on the input, Escape and Tab keep the typed text, a click on the input opens only with `open-on-input-click`. `inline` (modes both/inline): the arrows show the highlighted option's text in the input with the completed part selected; Escape takes it back to the typed text; leaving the input accepts it. `Autocomplete.Root` renders `<lu-combobox free>` and provides the Combobox parts' context (moved to combobox/context.ts) with the input's name, required and initial text; `value`/`onValueChange` are the input's text.

Base UI 1.9 comparison: Root `value`/`defaultValue`/`onValueChange` (string), `open`/`onOpenChange`, `mode` list|both|inline|none (default list), `openOnInputClick` (default false), `name`, `required`, `disabled`; parts as Combobox's (Label, Input, Trigger, Clear, Popup, List, Item, Group, GroupLabel, Empty, Status). Not done: `items`/`filter` function (markup and contains/startsWith instead; `mode="none"` hands filtering to the page as `filter={null}`), `autoHighlight`, `keepHighlight`, `submitOnItemClick`, `limit`, virtualized, grid. Zag combobox with `allowCustomValue`: same free-text behaviour.

doc-9 section 6 (combobox): APG list autocomplete keys (arrows, Enter, Escape, Tab), focus stays in the input with aria-activedescendant, popup dismissal through the shared layer model, isComposing ignored, async results (mode none, the island test), and in Fields. Section 17: 2.1.1, 4.1.2 (aria-autocomplete list/both/inline/none), 2.4.7, 2.5.8, 1.4.10/1.4.12, 3.3.1/3.3.2 with Field, axe light and dark, closed and open, on /autocomplete and /autocomplete/island.

Evidence: unit tests autocomplete/autocomplete.test.tsx (server HTML, modes, Fields), autocomplete.types.test.tsx; ui-e2e e2e/autocomplete.e2e.ts (no-JS submission of the text, filtering and opening, list highlight and filling, click, clear, inline completion with Escape and Tab, Field validation, island with page-filtered results and no LUM warnings, axe, focus, targets, reflow, per-page scripts). Docs: autocomplete.md, combobox.md (related), field.md, README and theming rows, live demo autocomplete-1. Screenshot: backlog/assets/task-377-autocomplete.png.

Sizes (min/gzip/brotli kB): script (shared with Combobox) 12.95/4.57/4.10; component JS 20.02/6.63/5.98; CSS (Combobox's) 2.17/0.49/0.41.

New public names (TASK-400): `Autocomplete` (Root plus Combobox's parts), `AutocompleteRootProps`, `AutocompleteMode`, `AutocompleteLabelProps`, `AutocompleteInputProps`, `AutocompleteTriggerProps`, `AutocompleteClearProps`, `AutocompletePopupProps`, `AutocompleteListProps`, `AutocompleteItemProps`, `AutocompleteGroupProps`, `AutocompleteGroupLabelProps`, `AutocompleteEmptyProps`, `AutocompleteStatusProps`, `lu-combobox` attributes `free`, `inline`, `open-on-input-click`, entries `@lumiose/ui/autocomplete`, `@lumiose/ui/autocomplete.css` (Combobox's CSS).

2026-10-16 (Halo): checks green: pnpm check (2298 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (559 passed; the 4 failures were this batch's: two per-page script checks missing the shared layer/place chunks and the Select picker flipping under the longer nav, fixed in the next commit, 70 passed on rerun), apps/web Playwright 125 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Autocomplete ships as Combobox's element in a free mode (`<lu-combobox free>`) with Combobox's parts: the input submits the text, typing filters and opens the suggestions, choosing fills one in, Escape and Tab keep the text, and modes list, both, inline and none follow Base UI (inline completion with Escape to take it back). Unit, type and ui-e2e tests (keys, inline completion, Fields, island with page-filtered results, axe light/dark), docs page, rows and a live demo; all checks green. Gaps: autoHighlight, keepHighlight, submitOnItemClick, limit. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
