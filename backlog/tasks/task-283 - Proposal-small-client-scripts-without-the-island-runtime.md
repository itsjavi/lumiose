---
id: TASK-283
title: 'Small scripts: .html scripts through ?client, and the typed attribute pattern'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-20 21:23'
labels:
  - islands
  - performance
milestone: m-13
dependencies: []
priority: high
ordinal: 285000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 6. Any page with an island loads the loader chunk with the runtime: about 13 kB gzip per page on the port (loader plus two small islands), where the Astro site's hand-written inline scripts for the same theme toggle and search were 1-2 kB. .html imports with <script> render an empty client:load island, so they load the runtime too. Options: document the cost, or a way to ship a plain module script from a component without the runtime.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded (decision-71, approved by the user on 2026-10-20)
- [ ] #2 .html imports with a <script> ship it through the ?client path: a page with no islands loads that script and no island runtime
- [ ] #3 concepts/islands.md and guides/web-components.md show the typed attribute pattern (a custom element in JSX.IntrinsicElements, attributes read in connectedCallback)
- [ ] #4 Tests cover a static page with an .html script and no island
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike. F2: there is no way to ship a custom element's definition (a web component's script) with a server-rendered page that has no island; whatever this proposal decides should cover that case.

2026-10-15 (Nova): the ?client import (decision-63, TASK-354) covers this: a component imports a small browser script with ?client and calls the import while it renders; the pages that render it load just that script as a module script, without the island runtime (documented in concepts/islands.md, "Scripts of server-rendered components"). A theme toggle is import theme from "./theme.ts?client" plus theme() in the header component. Left open: .html imports with <script> still load their scripts through an empty client:load island, so those pages still load the runtime; the content plugin could ship them through ?client instead (a proposal for Lux, not started).

2026-10-16 (Beacon): examples/ui-spike, mentioned above, was removed in TASK-363; it remains in the git history.

2026-10-20 (Lux): decided in the grilling session (decision-71). ?client stays the only mechanism; data goes through attributes; no new API. The remaining work is the .html route and the documented pattern.
<!-- SECTION:NOTES:END -->
