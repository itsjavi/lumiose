---
id: TASK-183
title: Lockstep versioning and release tooling
status: To Do
assignee:
  - Photon
created_date: '2026-10-10 00:25'
labels:
  - release
  - ci
milestone: m-7
dependencies:
  - TASK-39
priority: medium
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: same version for all packages, with helpers so nothing is bumped by hand. Agreed design: pnpm release:version <x.y.z> bumps every public package, the @lumiose/compiler-<platform> packages and the Cargo workspace version together, pins internal deps to the exact version, generates CHANGELOG.md from Conventional Commits since the last tag, commits 'chore(release): vX.Y.Z' and creates one tag vX.Y.Z (never pushed or created by agents unless the user runs it). A release workflow on v* tags builds the binaries and publishes all packages with npm provenance (platform packages first); until the user says publish, CI runs only the dry-run. Start at 0.1.0. No Changesets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 release:version script with a --dry-run mode and tests (bumps, internal deps, changelog, commit/tag only when run for real)
- [ ] #2 release.yml publishes on tags in the right order with provenance (dry-run path exercised in CI); CONTRIBUTING documents the release flow
<!-- AC:END -->
