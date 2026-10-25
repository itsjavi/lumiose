---
id: TASK-582
title: Language server stsx mode for projects without Lumiose
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
labels:
  - tooling
  - stsx
milestone: m-14
dependencies:
  - TASK-581
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - packages/language-server/src/workspace.ts
  - packages/language-server/src/providers.ts
priority: medium
ordinal: 574000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-86's language server mode. A project that depends on @lumiose/stsx but not on lumiose gets an stsx mode of the same server, picked automatically per project.
- **Shadows.** Found from the `rootDirs` pair (including `.lumiose/stsx`).
- **Kept.** TypeScript features, CSS features, and the class-name features, counting both `class` and `className`.
- **Removed.** LUM2xxx and LUM4xxx diagnostics, the execution-contract hovers and the route types.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A project that depends on @lumiose/stsx and not lumiose gets stsx mode; Lumiose projects keep the full mode
- [ ] #2 In stsx mode, TypeScript and CSS features work in .stsx files through shadows found from the rootDirs pair
- [ ] #3 Only scanner and LUM3xxx diagnostics are shown, with no execution-contract hovers; class-name completion and unused-class checks count className
- [ ] #4 Verified in VS Code on a React fixture, with a screenshot in backlog/assets
<!-- AC:END -->
