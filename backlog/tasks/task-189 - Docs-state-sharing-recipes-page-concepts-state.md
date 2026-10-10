---
id: TASK-189
title: 'Docs: state-sharing recipes page (concepts/state)'
status: Done
assignee:
  - Lux
created_date: '2026-10-10 03:14'
updated_date: '2026-10-10 03:16'
labels:
  - docs
dependencies: []
priority: medium
ordinal: 189000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: after comparing Jotai, Zustand and TanStack Query/DB with our primitives, turn the parts that need no new API into docs recipes: where state lives (component, context, module scope), a store with actions (Zustand-style) provided through context, keyed families (atomFamily), a persisted signal (atomWithStorage / persist), bridging an external store (zustand/vanilla, jotai store, any subscribe/get), and sharing state between islands. Scoped state, a keyed async cache, reconcile, optimistic updates and a query-core adapter stay proposals (API shape needs user approval).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New concept page docs/concepts/state.md with the five concept sections; every recipe example is type-checked (check fences)
- [x] #2 Linked from the docs index and from the signals page; llms.txt regenerated; docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (standalone; docs structure is Beacon's, page added in the existing concept pattern). New docs/concepts/state.md: where state lives, a Jotai/Zustand/Valtio feature map, recipes (store with actions via context, state shared by islands, families, persisted signal, external store bridge). Found while writing: during SSR an island renders under the page's owner and sees page context, but hydrates under a fresh root and gets the default; documented as a common mistake, and it motivates the scoped-state proposal. Validation: docs:gen, docs:check, packages/cli/src/docs tests (examples type-checked with the control file).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the Sharing state concept page with type-checked recipes, linked from the index, signals and islands pages; llms.txt regenerated.
<!-- SECTION:FINAL_SUMMARY:END -->
