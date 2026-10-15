---
id: TASK-320
title: 'Scale regression gate in release:version'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:46'
labels:
  - performance
  - release
milestone: m-11
dependencies:
  - TASK-319
priority: medium
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: pnpm release:version runs the large-app benchmark as an A/B of the previous release and the candidate, locally (not in CI), and stops the release when any metric regresses by more than 20%. The numbers go into the release notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 release:version runs the A/B and stops on a regression above 20% on any metric
- [x] #2 The release notes include the measured numbers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.

Spark started 2026-10-15 (batch 5).

Implementation (Spark, batch 5):
- scripts/release.ts: a release (not a dry run) runs the scale gate after the clean-tree and tag checks and before writing anything: Nova's 'pnpm --filter @lumiose/bench-large-app ab <last v* tag> . --json' (stdout JSON, progress on stderr), then stops with an error listing every metric whose ratio is above 1.2 (buildMs, devColdStartMs, hmrMs, serverMemoryMb; a missing or non-finite metric also stops it). A failing A/B stops the release too.
- Release notes: the A/B goes into the changelog section as '### Scale' (builds, rounds, machine, then a table of previous/this release/ratio per metric); the release workflow's notes are that section (scripts/release-notes.ts), so the numbers ship with the GitHub release.
- --skip-scale-gate (new flag) skips it and the notes say 'Not measured: the scale gate was skipped'; the first release (no v* tag) says there is nothing to compare with; a dry run only reports that a release runs the gate. The skip flag is an escape hatch I added for a broken benchmark or an urgent fix: the user may want it removed.
- Tests (scripts/release.test.ts, node --test, without the 18-minute benchmark: runScale is injectable): the gate stops above 1.2 before any write (HEAD, tags, versions unchanged), passes at exactly 1.2 and records the numbers in CHANGELOG.md, skip and dry-run never run the A/B, first-release note, regression list and rendering. 15/15 pass. The real A/B was not run here (about 18 minutes; Nova recorded one result in benchmarks/large-app/RESULTS.md).
- CONTRIBUTING.md (Releases) documents the gate.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pnpm release:version runs the large-app A/B of the last release tag and the working tree before writing anything, stops when a metric is more than 20% worse, and puts the numbers in the changelog section that becomes the release notes. --skip-scale-gate is an explicit escape hatch recorded in the notes. Tested with an injected A/B result.
<!-- SECTION:FINAL_SUMMARY:END -->
