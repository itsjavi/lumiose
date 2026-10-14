---
id: TASK-277
title: Create the GitHub release when a version is published
status: Done
assignee:
  - Lux
created_date: '2026-10-14 00:36'
updated_date: '2026-10-14 00:37'
labels: []
dependencies: []
ordinal: 279000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request 2026-10-14: like lamina, notemd and quickedit, a pushed vX.Y.Z tag should also create a GitHub release. release.yml only publishes to npm. Add a job after a real publish that creates (or updates) the release named after the tag, with the version's CHANGELOG.md section as notes, pre-release for x.y.z-* tags.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 release.yml creates or updates the GitHub release after a real publish only (never on dry runs or workflow_dispatch)
- [x] #2 The notes are the version's CHANGELOG.md section, from a tested script
- [x] #3 CONTRIBUTING's Releases section describes it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: release.yml gains a github-release job (needs publish; only on a tag push with LUMIOSE_PUBLISH=true, so dry runs and workflow_dispatch create nothing; contents: write). It runs node scripts/release-notes.ts <version> (the CHANGELOG.md section without its heading, plus an install line; exits 1 without a section) and gh release create --title <tag> --notes-file --verify-tag (--prerelease for x.y.z-*), or gh release edit on a re-run, as lamina's release.yml does. Checks: node --test scripts/release-notes.test.ts 3/3, the script on v0.3.0 and on a missing version, actionlint, oxlint, oxfmt. Not run in CI yet: the first real run is the v0.4.0 tag.
<!-- SECTION:NOTES:END -->
