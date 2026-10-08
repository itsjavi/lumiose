---
id: TASK-27
title: Implement shadow TSX files and lumen check
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:24'
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
- [x] #1 Shadow writer and deleter for .lumen/shadow; tsconfig template per spec §4.7; typegen is run first
- [x] #2 lumen check runs tsc --noEmit (TS 7), maps shadow paths back to .stsx with the same line and column, and merges compiler and lint diagnostics; --format json; meaningful exit codes
- [x] #3 Tests including $ref type errors and route types
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-task27-20261008T131328Z), 2026-10-08T13:24Z:
- Modules (packages/lumen/src/cli/): check/shadow.ts (syncShadows(root,{files?}), shadowPathFor, sourcePathForShadow; lazy-loads @lumen/compiler, rewrites only changed shadows, deletes orphans + empty dirs), check/tsconfig.ts (tsconfigTemplate/formatTsconfig per spec §4.7; tsconfigProblems on `tsc --showConfig` output: jsx, jsxImportSource, rootDirs, shadows and .lumen/types among program root files, types lumen/env), check/tsc.ts (resolve typescript from the project, fallback lumen's own; runTsc; parseTscOutput for --pretty false incl. chained messages and global diagnostics), check/text.ts (UTF-16 line/col, TS line breaks), check/diagnostics.ts (CheckDiagnostic model, CheckFailure), check/report.ts (human code frames, JSON), check/index.ts (check(), checkCommand(), DiagnosticProvider hook), main.ts (node:util parseArgs dispatch), bin.ts.
- lumen check flow: typegen (Nova's typegen(), its manifest diagnostics merged) → syncShadows (scanner diagnostics merged) → `tsc --showConfig` and `tsc --noEmit -p <tsconfig> --pretty false` in parallel (cwd = realpath(root)) → shadow paths mapped to .stsx, same line/col → providers hook (compiler compile()/lint later) → sort + dedupe. Exit 0 ok / 1 errors / 2 tool failure (missing root/tsconfig/TypeScript/binding, tsc non-zero without diagnostics). JSON: { diagnostics: [{ source, code, severity, file, line, column, endLine, endColumn, message, help?, docs? }], summary: { errors, warnings, hints, files }, failure? }.
- Verified on TS 7.0.2: columns are UTF-16 (emoji before an error), `./X.stsx` imports resolve to shadows from .tsx and from other shadows, route shadows reached via include.
- Limitation: tsc --pretty false prints only start positions; endLine/endColumn is the token at the start (exact for names/members/literals, 1 char otherwise).
- Provisional code LUM6001 for tsconfig warnings (not in registry.rs) — needs Lux/Photon decision.
- Deps: lumen now depends on @lumen/compiler (workspace:*), lockfile updated. packages/lumen/tsconfig.json excludes src/cli/check/__fixtures__. Rebuilt the napi binding (it was older than the committed crate sources).
- Not done (follow-ups): `lumen typegen` CLI should also sync shadows (spec §9.1, TASK-28); scanning .tsx for LUM1006 in check; check tests skip when the native binding is not built (same as compiler tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shadow TSX + lumen check (packages/lumen/src/cli/check/). syncShadows mirrors src/**/*.stsx to .lumen/shadow/<path>.stsx.tsx with the scanner's UTF-16 masked text (write-on-change, orphan deletion, partial files mode) for check/dev/LSP. tsconfig template per spec §4.7 plus LUM6001 (provisional) warnings at the offending key from tsc --showConfig. lumen check runs typegen, shadow sync and TS 7 tsc --noEmit --pretty false, maps shadow paths back to .stsx at the same line/column, merges scanner + route diagnostics and a DiagnosticProvider hook (compiler/lint), prints code frames or --format json, exits 0/1/2. CLI: lumen check [--root] [-p] [--format json] via node:util parseArgs.
Evidence: check.test.ts 13/13 (fixtures valid + errors): TSX error after a style block on a non-ASCII line at 8:42 'toUpperCase'; $radius.lgg → TS2339 at 'lgg', $acent → TS2552 at 'acent', top-level $spacing → TS2304 at 'spacing'; cross-.stsx import prop error TS2322; route params.id TS2339 against typegen RouteMap; LUM1005 with help/docs; valid project exit 0; errors exit 1 (also via bin subprocess); missing tsconfig/unknown args exit 2; tsconfig warnings located at keys. pnpm typecheck OK; pnpm test 42 files/395 tests OK; oxlint clean on cli (repo-wide pnpm lint fails only on Spark's WIP dom/list.ts:214 no-new-array).
<!-- SECTION:FINAL_SUMMARY:END -->
