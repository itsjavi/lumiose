---
id: TASK-247
title: 'useId(): unique ids that match between server render and hydration'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 19:31'
labels:
  - runtime
  - api
milestone: m-9
dependencies: []
priority: high
ordinal: 249000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-43. useId() from lumiose: server id from the component instance's render-tree position; in islands, island id + island-relative instance path; hydration reuses it; client-only renders use a counter; a prefix option for several apps on one page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 useId() returns the same id on the server and after hydration, also inside islands and nested components
- [ ] #2 Client-only renders get unique ids; a prefix option separates apps on one page
- [ ] #3 Docs (reference/reactivity, an accessible-form example) and tests, including server/client parity
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user approved an idPrefix option on mount()/hydrate() and on the SSR render entry. Spark may edit the server render files under packages/lumiose/src/server/** that useId needs (coordinate: Nova works in app/** meanwhile).
<!-- SECTION:NOTES:END -->
