---
id: TASK-321
title: One 10 kB cap for the whole app runtime
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 04:03'
labels:
  - performance
milestone: m-11
dependencies: []
priority: high
ordinal: 323000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: packages/lumiose/scripts/size.ts gets one hard cap of 10 kB brotli for the runtime a full app ships together: core, dom, islands, the router, actions, fetchJSON and view transitions (about 6.5 kB today). Going over fails pnpm check. Opt-in packages (@lumiose/ui, @lumiose/query) are measured separately. If M10 or M11 work does not fit, find savings or ask the user to raise the cap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 size.ts measures the combined runtime and fails pnpm check above 10 kB brotli
- [ ] #2 Opt-in packages are reported separately
- [ ] #3 The docs that quote runtime sizes match the measurement
<!-- AC:END -->
