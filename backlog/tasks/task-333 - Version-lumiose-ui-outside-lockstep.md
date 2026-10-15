---
id: TASK-333
title: Version @lumiose/ui outside lockstep
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 17:32'
labels:
  - release
milestone: m-12
dependencies:
  - TASK-332
priority: low
ordinal: 335000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-54, @lumiose/ui keeps its own 0.x versions until its own 1.0, outside the lockstep versions of pnpm release:version. The release script supports a package with its own version and changelog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 release:version releases @lumiose/ui with its own version and changelog, leaving lockstep packages alone
- [x] #2 The release docs explain the exception
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-15. Implementation:
- Config: INDEPENDENT_PACKAGES in scripts/pack.ts (a list, today ["@lumiose/ui"]) names the packages outside lockstep; release.ts, publish.ts and pack.ts read it.
- pnpm release:version <x.y.z> --package @lumiose/ui [--dry-run] [--since <rev>]: bumps only packages/ui/package.json, prepends packages/ui/CHANGELOG.md (its own header) from the Conventional Commits scoped ui since the last @lumiose/ui@* tag, commits chore(release): @lumiose/ui@X.Y.Z and tags @lumiose/ui@X.Y.Z. No scale gate. Refuses a lockstep package, a private or missing one, and a version that is not higher.
- Lockstep releases skip the independent packages (no version check or bump) and leave the commits scoped ui out of CHANGELOG.md (header updated to say so). Scope, not paths: real ui commits also touch docs, examples and CLI tests (checked on Halo's branch: 0 ui entries in a lockstep dry run, both in the ui dry run).
- Publishing: release.yml also triggers on @lumiose/*@* tags; those skip the Binaries workflow and the artifact download, and scripts/publish.ts packs and publishes only the tagged package (tagProblem checks the tag against its version). A v* tag publishes the lockstep packages only. github-release reads the package's own CHANGELOG.md (scripts/release-notes.ts takes the tag). pack:check's one-version check ignores the independent packages.
- SOURCE_PACKAGES in scripts/pack.ts lets @lumiose/ui's exports name .ts/.tsx files (it ships sources for the app's compiler, Halo's TASK-353 decision); pack:check rejected them before.
- Tests: scripts/release.test.ts (fixture with a public @lumiose/ui: lockstep release leaves it, --package releases it with its own changelog and tag, next release lists only later commits, refusals), scripts/release-notes.test.ts (tags, install line), new scripts/publish.test.ts (tags), scripts/pack.test.ts (source exports). Scratch-clone dry run with Halo's branch merged and private removed: both plans correct.
- Docs: CONTRIBUTING.md Releases, 'Packages outside lockstep'. AGENTS.md's Releases bullet (Lux's file) could mention --package.
- For the user's review: the --package flag, the <name>@<x.y.z> tag format (changesets style), and the commit-scope rule for the changelogs.
- Last step not done here: packages/ui is not on main yet (Halo's branch). Making it public (drop private: true, first release --package @lumiose/ui 0.1.0) is recorded as a follow-up task.

2026-10-15 (user): confirmed --package, the <name>@<x.y.z> tag format and the changelog split by the ui commit scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
pnpm release:version <x.y.z> --package @lumiose/ui releases it alone with its own version, changelog (commits scoped ui) and <name>@<x.y.z> tag; lockstep releases, pack:check and publishing leave it alone; release.yml publishes it from its own tag without the Binaries workflow. Configured by INDEPENDENT_PACKAGES in scripts/pack.ts, tested with a fixture (scripts/*.test.ts, 48 pass) and dry-run against Halo's real packages/ui in a scratch merge. CONTRIBUTING.md explains the exception. packages/ui is not on main yet: making it public is TASK-389.
<!-- SECTION:FINAL_SUMMARY:END -->
