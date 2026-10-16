---
id: TASK-421
title: DocsSearch on @lumiose/ui
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 03:36'
updated_date: '2026-10-16 03:39'
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
- [ ] #1 DocsSearch uses @lumiose/ui's combobox parts, or the decision to keep it custom is recorded with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Site adoption (TASK-362).
<!-- SECTION:NOTES:END -->
