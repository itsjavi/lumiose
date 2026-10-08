---
id: TASK-27
title: Implement shadow TSX files and lumen check
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:13'
labels: []
milestone: m-4
dependencies:
  - TASK-8
  - TASK-21
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stock TS 7 must type-check .stsx through masked shadow files with identical UTF-16 offsets (decision-11, spec §9.1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shadow writer and deleter for .lumen/shadow; tsconfig template per spec §4.7; typegen is run first
- [ ] #2 lumen check runs tsc --noEmit (TS 7), maps shadow paths back to .stsx with the same line and column, and merges compiler and lint diagnostics; --format json; meaningful exit codes
- [ ] #3 Tests including $ref type errors and route types
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shadow writer (src/cli/check/shadow.ts): syncShadows(root,{files?}) masks every src/**/*.stsx via @lumen/compiler scan() into .lumen/shadow/<path>.stsx.tsx, rewrites only on change, deletes orphans; returns scanner diagnostics.
2. tsconfig template + checker (src/cli/check/tsconfig.ts) per spec §4.7; lumen check warns on missing options.
3. tsc runner + --pretty false parser (src/cli/check/tsc.ts); resolve typescript bin from the project (fallback: lumen's own); map shadow paths back to .stsx at the same line/column.
4. Diagnostics model, human code frames and stable --format json (src/cli/check/report.ts); merge scanner, route (typegen manifest) and a compiler-diagnostics hook.
5. lumen check command (src/cli/check/index.ts) + minimal arg parsing in src/cli/bin.ts; exit codes 0/1/2.
6. Vitest fixture project under src/cli/check/__fixtures__ (valid, TSX error after style block, bad $ref, .stsx imports, typed route params); verify JSON and exit codes.
7. pnpm typecheck / test / lint.
<!-- SECTION:PLAN:END -->
