---
id: TASK-421
title: DocsSearch on @lumiose/ui
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:36'
updated_date: '2026-10-16 04:53'
labels:
  - ui
  - web
milestone: m-12
dependencies: []
ordinal: 419000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Beacon in TASK-362 (2026-10-16). apps/web/src/islands/DocsSearch.stsx hand-rolls an APG combobox (input, listbox of results, aria-activedescendant, the '/' shortcut, the lazily fetched search index). @lumiose/ui's Autocomplete fills the input with a chosen text, while the search's results are navigation links with the site's own ranking and descriptions. Decide whether Autocomplete (or Combobox) can host it, with external filtering, items as links and a description line, or whether it stays custom; if it moves, keep the shortcut, the lazy index and the no-JavaScript state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DocsSearch uses @lumiose/ui's combobox parts, or the decision to keep it custom is recorded with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Site adoption (TASK-362).

2026-10-16 (Beacon): Moved. apps/web/src/islands/DocsSearch.stsx runs on @lumiose/ui's Autocomplete: `mode="none"` (searchDocs ranks, the element filters nothing), `autoHighlight` (the first result is highlighted as you type, so Enter opens it, as before), `onValueChange` feeds the query and loads the index, `Autocomplete.Empty` shows Loading / unavailable / nothing matches while the query is not empty. Autocomplete rather than Combobox: Combobox is select-like and puts the chosen label back on Escape and blur, which emptied the typed query; Autocomplete keeps the text. Results stay links: each Item holds the `<a href>` with the section, title and snippet; an `on:click` stops the click before the element (which would fill the item's value into the box), so the link navigates, with modifier keys too. Enter is a native keydown listener on the input (it runs before the element's): it opens the highlighted result (its `data-value`, the URL) or the first. Kept: the "/" shortcut, the lazily fetched search.json (first focus or keystroke), `data-ready`, `role=search`, the no-JS state (an inert text field), the site's look (the popup is a top-layer popover placed by `@lumiose/ui/autocomplete.css`, styled by the island's classes; compared in dev before and after). The listbox is now named by the label ("Search the docs"), since the part's `aria-labelledby` wins over an `aria-label`; apps/web e2e updated (ui.e2e, web.e2e). Checked in dev: typing highlights the first result, arrows move, Escape closes and keeps the text, Enter and a click open the result, the empty state shows. Checks: apps/web e2e full run 176 passed, 3 failed (the listbox name), then the search, base-path and a11y tests 142 passed after the fix (temporary config on 5294/5296).
<!-- SECTION:NOTES:END -->
