---
id: TASK-504
title: Landing e2e test expects the Astro note's old copy
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:55'
updated_date: '2026-10-21 04:59'
labels:
  - test
dependencies: []
priority: high
ordinal: 500000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI e2e (ubuntu) failed in runs 39523378481 and 39539444578: apps/web/e2e/web.e2e.ts 'the landing page presents Lumiose with benchmark evidence' looks for a #compare .note matching /^Astro's interactive islands need a second UI framework\.$/ and finds none. Deterministic: 9f8a58de (TASK-482) changed ASTRO_NOTE in apps/web/src/content/stacks.ts to 'Astro's interactive islands use a second UI framework: Preact in the fullstack comparison, …' without updating the e2e test, which only runs in the e2e job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The landing test matches the current ASTRO_NOTE copy
- [ ] #2 The test passes in Chromium (static project), 5 repeats
<!-- AC:END -->
