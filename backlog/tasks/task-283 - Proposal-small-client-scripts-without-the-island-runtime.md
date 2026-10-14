---
id: TASK-283
title: 'Proposal: small client scripts without the island runtime'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
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
