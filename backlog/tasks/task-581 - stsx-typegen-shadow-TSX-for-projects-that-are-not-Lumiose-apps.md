---
id: TASK-581
title: 'stsx typegen: shadow TSX for projects that are not Lumiose apps'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
labels:
  - tooling
  - stsx
milestone: m-14
dependencies:
  - TASK-578
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - packages/cli/src/check/shadow.ts
  - packages/vite/src/layout.ts
priority: medium
ordinal: 573000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-86's type checking. Add an `stsx typegen` bin to @lumiose/stsx; Beacon may edit packages/stsx/src/typegen/** and the bin entry for this task.
- **Shadows.** Masked-TSX shadows are written into the directory named by the tsconfig `rootDirs` pair, default `.lumiose/stsx`, reusing @lumiose/cli/tooling's shadow sync (generalised for a configurable directory). Stale shadows are removed.
- **Missing pair.** The bin prints the `rootDirs` line to add.
- **Dev and build.** The plugin keeps the shadows fresh.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 stsx typegen writes masked-TSX shadows for every .stsx file into the rootDirs pair's directory (default .lumiose/stsx) and removes stale ones
- [ ] #2 Without a rootDirs pair, it writes to .lumiose/stsx and prints the tsconfig line to add
- [ ] #3 vite dev and vite build with stsx() keep the shadows fresh
- [ ] #4 stsx typegen && tsc type-checks React, React Router and Solid fixtures, reporting errors at the .stsx line and column
- [ ] #5 The README and the guide document the tsconfig setup
<!-- AC:END -->
