---
id: TASK-344
title: Property tests fail at the nightly case count
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 08:03'
labels:
  - security
  - fuzzing
  - ci
milestone: m-11
dependencies: []
priority: high
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the first manual run of the nightly fuzz workflow (https://github.com/itsjavi/lumiose/actions/runs/38700307868), job "property tests" (pnpm --filter lumiose test:properties 200000). At 200,000 cases: src/app/server/csrf.property.test.ts (3 of 6 failed, including timeouts at Vitest's 5 s default), src/server/url.property.test.ts (3 of 5 failed, including "navigates only to http(s) URLs, and refuses the rest with a TypeError"), and src/app/server/redirect.property.test.ts ("throws a Redirect only to locations that resolve to http(s), and a TypeError otherwise", "Property failed after 5040 tests"). Tell real counterexamples (fix the code, keep the case as a regression test) from test-time limits (the high-count run needs a timeout that scales with the case count).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every failing property is diagnosed: a code fix with a regression case, or a corrected property with the reason recorded
- [ ] #2 test:properties at 200000 cases passes locally with timeouts that scale with the count
- [ ] #3 The fast pnpm test run is unchanged
<!-- AC:END -->
