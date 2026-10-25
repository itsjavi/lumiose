---
id: TASK-582
title: Language server stsx mode for projects without Lumiose
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 01:30'
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
- [x] #1 A project that depends on @lumiose/stsx and not lumiose gets stsx mode; Lumiose projects keep the full mode
- [x] #2 In stsx mode, TypeScript and CSS features work in .stsx files through shadows found from the rootDirs pair
- [x] #3 Only scanner and LUM3xxx diagnostics are shown, with no execution-contract hovers; class-name completion and unused-class checks count className
- [ ] #4 Verified in VS Code on a React fixture, with a screenshot in backlog/assets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Beacon's task at the user's request (M14 run).

2026-10-25 (Lux): stsx mode in packages/language-server.
- **Mode selection** (src/stsx-mode.ts): `isStsxProject(root)` is true when package.json depends on @lumiose/stsx and not on lumiose (cached per root).
- **Shadows.** In stsx mode, shadows go to `<root>/.lumiose/stsx/<root-relative path>.stsx.tsx`, the layout `stsx typegen` uses. `syncStsxShadows` writes them without Lumiose's generated tsconfig. The workspace mapping (shadow ↔ source, rewriting shadow paths in TypeScript messages) accepts `.lumiose/shadow` and `.lumiose/stsx`.
- **Diagnostics** (providers.ts): `compileTsx` scanner and style diagnostics, read with `className` when the file writes it, else `class`. No LUM2xxx or LUM4xxx, and no project checks (LUM4003, LUM3012).
- **Hovers.** No execution-contract hovers.
- **Class features** (classes.ts) read `class`, `className` and Solid's `classList` in every mode.
- **Not covered.** A custom shadow directory (a `rootDirs` entry such as `.types/stsx`) is not followed by the language server: only `.lumiose/stsx`.
- **Tests** (src/stsx-mode.test.ts, 4, against the real TypeScript 7 LSP with an stsx-workspace fixture): shadows in `.lumiose/stsx` and no Lumiose files; diagnostics are exactly ts:2322 and lumiose:LUM3005 (`.unused`, read from className); class completion in `className=""`; a hover with no contract. The full language-server suite passes (63).
- **VS Code** activates on `workspaceContains:**/*.stsx` and uses the bundled server, so React projects get it. The README has an Editors section.
- **AC#4 not done.** Verification in VS Code with a screenshot needs a VS Code session, which this run had none of. It is left for the user (or a computer-use pass), so the task stays In Progress.
<!-- SECTION:NOTES:END -->
