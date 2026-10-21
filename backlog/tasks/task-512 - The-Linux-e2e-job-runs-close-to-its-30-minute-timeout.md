---
id: TASK-512
title: The Linux e2e job runs close to its 30-minute timeout
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 05:48'
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
- [x] #1 Linux runs apps/web and the examples/* suites in two e2e jobs, each with its own results artifact; macOS and Windows keep the smoke subset
- [x] #2 actionlint finds no new issue in ci.yml, and CONTRIBUTING describes the jobs
- [x] #3 The structure is recorded as a decision
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): ci.yml's e2e matrix has a part per entry: site (apps/web, with wasm32 and wasm-bindgen), examples (examples/*, vite-counter first), and smoke on macOS and Windows. Each job's name and artifact (playwright-results-<os>-<part>) include the part. From the last runs: apps/web about 10-13 min and the examples about 12 min, plus about 3 min of setup each. actionlint reports no new issue (the two shellcheck notes were already there). main has no branch protection, so no required check names the old job. CONTRIBUTING describes the jobs. Decision: decision-76. The new wall time is verified only by the next CI run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI's Linux e2e runs as two jobs, site (apps/web) and examples (examples/*), each about half its 30-minute timeout, with its own results artifact. macOS and Windows keep the smoke subset (decision-76).
<!-- SECTION:FINAL_SUMMARY:END -->
