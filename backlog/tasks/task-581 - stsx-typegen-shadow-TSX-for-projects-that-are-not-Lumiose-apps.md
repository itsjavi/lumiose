---
id: TASK-581
title: 'stsx typegen: shadow TSX for projects that are not Lumiose apps'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:27'
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
- [x] #1 stsx typegen writes masked-TSX shadows for every .stsx file into the rootDirs pair's directory (default .lumiose/stsx) and removes stale ones
- [x] #2 Without a rootDirs pair, it writes to .lumiose/stsx and prints the tsconfig line to add
- [x] #3 vite dev and vite build with stsx() keep the shadows fresh
- [x] #4 stsx typegen && tsc type-checks React, React Router and Solid fixtures, reporting errors at the .stsx line and column
- [ ] #5 The README and the guide document the tsconfig setup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Beacon's task at the user's request (M14 run).

2026-10-25 (Lux): the shadow writer lives in packages/stsx/src/typegen.ts, not in @lumiose/cli/tooling. A non-Lumiose project should not install Lumiose's CLI; the writer is small (`scan()` of @lumiose/compiler plus a directory walk). This is a technical deviation from the task description.

- **Shadow directory.** The `rootDirs` entry named `stsx` (`.lumiose/stsx` by default, or e.g. `.types/stsx`), read from tsconfig.json (comments and trailing commas allowed, `extends` not followed). Shadows mirror root-relative paths.
- **`stsx typegen [root]`** (src/cli.ts, bin src/bin.ts → dist/bin.js) writes every shadow, removes stale ones, and prints the `rootDirs` line when tsconfig does not name the directory.
- **The plugin** syncs shadows in `buildStart` (once per process) and rewrites (or removes) a file's shadow when it changes. `.lumiose/` is already ignored by the repo's `.gitignore`.
- **Tests** (src/typegen.test.ts, 5): shadows masked and offset-identical; stale shadows removed and the hint printed; a custom `rootDirs` directory; the dev server writes shadows and refreshes them on an edit; `tsc` (TS 7.0.2) passes on React and Solid fixture copies; an injected error is reported as `App.stsx.tsx(line,col)` at the `.stsx` position.
- **React Router**, checked by hand on the TASK-571 app: `stsx typegen` plus `react-router typegen && tsc` passes with `rootDirs [".", "./.react-router/types", ".lumiose/stsx"]`, and an injected error is reported at `Counter.stsx(13,39)`. Its vite.config.ts needed excluding there only because the linked package resolves its own vite types (a linked-checkout artifact; with an installed package vite is a peer dependency).
- **README:** a "Type checking" section (rootDirs, include, `stsx typegen && tsc`, a custom directory, `.gitignore`). The guide comes with TASK-583.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
stsx typegen and the plugin write masked-TSX shadows into the rootDirs directory named stsx (default .lumiose/stsx), remove stale ones and print the tsconfig line when missing. Stock tsc then checks React, Solid and React Router projects at the .stsx line and column. Documented in the README; the guide follows in TASK-583.
<!-- SECTION:FINAL_SUMMARY:END -->
