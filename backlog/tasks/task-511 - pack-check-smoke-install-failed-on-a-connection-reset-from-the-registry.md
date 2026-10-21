---
id: TASK-511
title: 'pack:check smoke install failed on a connection reset from the registry'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 04:57'
updated_date: '2026-10-21 05:48'
labels:
  - ci
dependencies: []
priority: medium
ordinal: 507000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI pack failed once (38793766243): scripts/pack.ts --smoke runs 'npm install' in the smoke app, whose dependencies outside the packed tarballs come from the npm registry, and npm gave up with 'ECONNRESET … network read ECONNRESET' after its default 2 fetch retries (21 s). A network flake of the runner, not of the code: it cannot be removed, only retried. The installs pass --fetch-retries=5, with the reason next to it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both npm installs of pack:check retry fetches 5 times, documented next to the flag
- [x] #2 node --test scripts/pack.test.ts passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Beacon): NPM_INSTALL in scripts/pack.ts holds the install flags for both installs, with --fetch-retries=5 and the reason next to it. node --test scripts/pack.test.ts passes (13 tests), and pnpm pack:check --smoke passes locally (the smoke app installs, checks, builds and passes its browser test in dev and build).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pack:check's npm installs retry registry fetches 5 times (npm's default is 2), the only retry CI has, for a network flake that cannot be removed (decision-76).
<!-- SECTION:FINAL_SUMMARY:END -->
