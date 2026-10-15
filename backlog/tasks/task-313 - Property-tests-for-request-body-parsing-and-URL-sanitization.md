---
id: TASK-313
title: Property tests for request body parsing and URL sanitization
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 04:02'
labels:
  - security
  - testing
milestone: m-11
dependencies: []
priority: medium
ordinal: 315000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: property-based tests (fast-check) for URL-encoded, multipart and JSON body parsing under the body and upload limits, the Origin check, redirect target validation and unsafe URL blocking in rendered attributes. pnpm test runs a small number of cases; the nightly fuzz workflow runs many more.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Property tests cover body parsing with limits, the Origin check, redirect validation and unsafe URL blocking
- [ ] #2 pnpm test runs them quickly, and the nightly workflow runs them with a high case count
- [ ] #3 Failures found are fixed or tracked as tasks
<!-- AC:END -->
