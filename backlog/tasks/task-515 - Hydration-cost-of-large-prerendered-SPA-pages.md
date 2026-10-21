---
id: TASK-515
title: Hydration cost of large prerendered SPA pages
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-21 05:59'
labels:
  - performance
milestone: m-13
dependencies: []
priority: medium
ordinal: 500000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the Dotmatrix Pocket React port (TASK-491, doc-11): the songs gallery's 18 kB of prerendered HTML becomes interactive at 2.8 s on a slow 4G + 4x CPU profile, slightly later than the client-rendered React SPA (2.7 s), although Lumiose shows it at 0.68 s. Profile the hydration of that page (claiming, effects, store snapshot after mount) and make large prerendered SPA pages interactive no later than a client render.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A profile of the gallery's hydration names where the time goes
- [ ] #2 The gallery becomes interactive before 2.7 s on the same profile (measured with an in-process A/B as AGENTS.md requires)
<!-- AC:END -->
