---
id: TASK-485
title: Release 0.5.0
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-21 03:56'
labels: []
milestone: m-13
dependencies:
  - TASK-283
priority: medium
ordinal: 481000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Release ?client and its follow-ups so the itsjavi.com port and the extracted repositories can use them from npm (decision-71, decision-73). Ask the user before the release and before the push.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The user approved the release and the push in chat
- [x] #2 pnpm release:version 0.5.0 ran and the release is published
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 (Lux): delta security review first (TASK-495 to TASK-501; the Medium TASK-495 and the Low TASK-496 fixed before the release, decision-75). pnpm check green except the load flake TASK-502. pnpm release:version 0.5.0 ran with the scale gate: production build 0.52x, dev cold start 1.02x, HMR 0.98x, peak RSS 1.02x against v0.4.0. The user approved the push in chat; main 13be67c4 and v0.5.0 pushed. Release, Binaries, CI and Pages workflows started. Done once 0.5.0 is on npm.

2026-10-21 (Lux): the Release workflow (run 39523377931) built and smoke-tested every binary and packed every package, then the first npm publish (@lumiose/adapter-cloudflare@0.5.0) failed with E404 Not Found on PUT, which is how npm answers an expired or under-privileged token (NODE_AUTH_TOKEN from the NPM_TOKEN secret; 0.4.0 published on 2026-10-14). Nothing was published: npm still has 0.4.0 for every package. Waiting for the user to renew the NPM_TOKEN secret (or set up trusted publishing), then re-run the failed publish job.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Delta security review first (TASK-495 to TASK-501; the Medium TASK-495 and Low TASK-496 fixed before the release, decision-75). pnpm release:version 0.5.0 ran with the scale gate (production build 0.52x, dev cold start 1.02x, HMR 0.98x, peak RSS 1.02x against v0.4.0). The first publish failed on the expired NPM_TOKEN secret; the user then set up npm trusted publishing for all 21 packages, and a re-run of the publish job published every package at 0.5.0 with provenance and created the GitHub release. The workflow no longer passes a token (e79d37dd).
<!-- SECTION:FINAL_SUMMARY:END -->
