---
id: TASK-389
title: Make @lumiose/ui public once it is on main
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 17:24'
updated_date: '2026-10-23 19:40'
labels:
  - ui
  - release
milestone: m-12
dependencies:
  - TASK-353
  - TASK-333
priority: medium
ordinal: 366000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-333 made release:version, publish.ts and pack:check support @lumiose/ui outside lockstep (INDEPENDENT_PACKAGES, SOURCE_PACKAGES in scripts/pack.ts). packages/ui still has private: true (TASK-353 kept it until TASK-333 landed). Once both are on main: drop private, run pnpm pack:check, and pnpm release:version 0.1.0 --package @lumiose/ui --dry-run to see the first release (the user releases; agents never tag or publish).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 packages/ui/package.json is not private and pnpm pack:check passes with it
- [x] #2 A dry run of pnpm release:version <x.y.z> --package @lumiose/ui shows its first release
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The user dropped private, released 0.1.0 with release:version and published it by hand (2026-10-23). 0.1.1 then went out through release.yml with trusted publishing and provenance, which proves the publisher. Publishing turned on create-lumiose's @lumiose/ui question (UI_PACKAGE.published), so Lux updated the terminal test that answered only two questions, and the docs README's status row.
<!-- SECTION:NOTES:END -->
