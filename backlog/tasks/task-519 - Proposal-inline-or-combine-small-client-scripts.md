---
id: TASK-519
title: 'Proposal: inline or combine small ?client scripts'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-21 07:22'
labels:
  - performance
  - proposal
milestone: m-13
dependencies: []
priority: low
ordinal: 513000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the itsjavi.com port on 0.5.0 (TASK-486, doc-11). After moving its small scripts to ?client, every page loads two or three script files of 0.25-0.78 kB gzip (theme toggle and search on every page, plus the gallery, copy button or comments script), each its own request: pages make 2 to 4 more requests than the Astro original, which inlines its small scripts. Total bytes are already lower than Astro's on every page but the editor, and the files are async and cached across pages, so this is about request count on a first view. Options: inline a ?client script under a size limit that has no imports (Astro's approach; a strict CSP then needs its hash in the policy), or combine the ?client scripts that the same set of pages loads into one chunk, as TASK-285 does for stylesheets. The emission lives in packages/vite/src/app/production (Nova) and packages/vite/src/client-scripts.ts (Photon).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A measurement on the port (or a sample site) compares first-view requests and bytes, and repeat-view bytes, for the current output and each option
- [ ] #2 A decision records the chosen behaviour (or no change), with the CSP consequences
<!-- AC:END -->
