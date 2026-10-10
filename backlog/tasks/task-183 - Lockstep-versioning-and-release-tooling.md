---
id: TASK-183
title: Lockstep versioning and release tooling
status: Done
assignee:
  - Photon
created_date: '2026-10-10 00:25'
updated_date: '2026-10-10 01:56'
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
- [x] #1 release:version script with a --dry-run mode and tests (bumps, internal deps, changelog, commit/tag only when run for real)
- [x] #2 release.yml publishes on tags in the right order with provenance (dry-run path exercised in CI); CONTRIBUTING documents the release flow
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-10): 20c0415. scripts/release.ts (pnpm release:version <x.y.z> [--dry-run] [--since]) with scripts/release.test.ts; scripts/publish.ts; release.yml (v* tags; calls Binaries via workflow_call; dry run unless vars.LUMIOSE_PUBLISH == 'true'; workflow_dispatch always dry run; needs npm trusted publishing or NPM_TOKEN when enabled). Verified: node --test scripts/*.test.ts, pnpm release:version 0.1.0 --dry-run on the repo, and a dispatched Release run (38014636970): all 7 platform binaries packed and npm publish --dry-run in order, platform packages before @lumiose/compiler. Windows path fix in release.ts output after the first CI run. Not done (user's call): no tag, no real publish; the first real release is pnpm release:version 0.1.0 then git push origin HEAD v0.1.0 with LUMIOSE_PUBLISH set. The vscode extension (private) stays out of the lockstep set.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lockstep release tooling: release:version bumps every published package, the platform packages and the Cargo workspace to one version, pins non-workspace internal deps, writes CHANGELOG.md from Conventional Commits since the last v* tag, commits and tags (never pushes). release.yml publishes on v* tags in dependency order with provenance, as a dry run until LUMIOSE_PUBLISH is true. CONTRIBUTING documents the flow.
<!-- SECTION:FINAL_SUMMARY:END -->
