---
id: TASK-512
title: The Linux e2e job runs close to its 30-minute timeout
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 04:59'
labels:
  - ci
dependencies: []
priority: high
ordinal: 508000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI e2e (ubuntu-latest) ran every Playwright suite in one job: 11.8 min at 7db9db0d (the last green run), then 22 to 29.7 min (39523378481: 29.7 min with a Playwright browser cache miss) as apps/web (66 to 178 tests, 10 to 13 min) and examples/ui-e2e (199 to 1042 tests, 7 to 9 min) grew. The job's timeout is 30 min: once the failing tests are fixed, a slow runner or a cache miss would cancel it instead. Split Linux into two jobs (the site, apps/web, with the WebAssembly toolchain; and every examples/* suite, vite-counter first) of about 15 minutes each, with a unique artifact name per job.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Linux runs apps/web and the examples/* suites in two e2e jobs, each with its own results artifact; macOS and Windows keep the smoke subset
- [ ] #2 actionlint finds no new issue in ci.yml, and CONTRIBUTING describes the jobs
- [ ] #3 The structure is recorded as a decision
<!-- AC:END -->
