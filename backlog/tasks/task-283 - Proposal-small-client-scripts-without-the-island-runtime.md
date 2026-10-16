---
id: TASK-283
title: 'Proposal: small client scripts without the island runtime'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-16 00:41'
labels:
  - proposal
  - islands
  - performance
dependencies: []
priority: low
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 6. Any page with an island loads the loader chunk with the runtime: about 13 kB gzip per page on the port (loader plus two small islands), where the Astro site's hand-written inline scripts for the same theme toggle and search were 1-2 kB. .html imports with <script> render an empty client:load island, so they load the runtime too. Options: document the cost, or a way to ship a plain module script from a component without the runtime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded; if a mechanism is added, its name is approved by the user and documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike. F2: there is no way to ship a custom element's definition (a web component's script) with a server-rendered page that has no island; whatever this proposal decides should cover that case.

2026-10-15 (Nova): the ?client import (decision-63, TASK-354) covers this: a component imports a small browser script with ?client and calls the import while it renders; the pages that render it load just that script as a module script, without the island runtime (documented in concepts/islands.md, "Scripts of server-rendered components"). A theme toggle is import theme from "./theme.ts?client" plus theme() in the header component. Left open: .html imports with <script> still load their scripts through an empty client:load island, so those pages still load the runtime; the content plugin could ship them through ?client instead (a proposal for Lux, not started).

2026-10-16 (Beacon): examples/ui-spike, mentioned above, was removed in TASK-363; it remains in the git history.
<!-- SECTION:NOTES:END -->
