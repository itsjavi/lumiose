---
id: TASK-354
title: Ship custom element definitions with server-rendered pages
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 16:46'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-346
priority: high
ordinal: 355000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). A page that renders a Menu or Combobox on the server, without an island, needs those elements' definitions in the browser (finding F2; see also TASK-283). The spike loaded them from instrumentation.client.ts by path. Ship each used element's definition with the pages that render it, and only those, without the island runtime. TASK-346 (F1) fixes the runtime leak a dynamic import causes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A server-rendered page with a lu-* element loads that element's definition and no island runtime
- [ ] #2 Pages without lu-* elements load none
- [ ] #3 Tests cover static, server and prerendered SPA pages
<!-- AC:END -->
