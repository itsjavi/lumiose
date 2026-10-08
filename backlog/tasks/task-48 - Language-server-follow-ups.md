---
id: TASK-48
title: Language server follow-ups
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-08 14:03'
updated_date: '2026-10-08 15:48'
labels:
  - tooling
dependencies:
  - TASK-29
priority: low
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Gaps found while implementing TASK-29 (packages/language-server). (1) Import syncShadows/shadowPathFor from a lumen package export (e.g. lumen/check; packages/lumen/package.json is Lux-owned) instead of the relative import in packages/language-server/src/shadows.ts. (2) Wire the compiler's compile() diagnostics (once @lumen/compiler exposes it) through ServerOptions.diagnosticProviders in src/bin.ts. (3) Restart the TS 7 LSP after a crash (today: error message, CSS/Lumen features keep working). (4) Cross-file class features: offer/define classes from <style global> blocks of other files (e.g. root _layout.stsx). (5) Merge CSS document symbols into TS symbols for .stsx; execution-contract hovers (spec §9.2). (6) Optionally filter TS window/logMessage verbosity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Language server imports the shadow API from a lumen package export
- [ ] #2 Compiler diagnostics flow into .stsx diagnostics with a protocol test
- [ ] #3 TS LSP crash recovery covered by a test
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. LSP crash recovery: supervise the TS 7 child; on unexpected exit restart with exponential backoff (cap + max attempts), re-initialize, re-open synced documents, refresh diagnostics.
2. Compiler diagnostics: a compile()-based DiagnosticProvider (target client) in the language server, debounced per open .stsx/.tsx document, UTF-16 spans mapped to LSP positions; wire into src/bin.ts and into lumen check via the existing DiagnosticProvider hook.
3. Cross-file global classes: index <style global> classes across workspace .stsx files for completion/definition.
4. CSS document symbols for .stsx merged with TS symbols.
5. Execution-contract hovers only if compile() meta exposes per-expression tracking; else propose a meta shape to Lux.
6. Protocol tests over stdio for each; pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-08, during TASK-30): AC #1 done: packages/language-server/src/shadows.ts imports from the lumen/tooling export (dependency lumen: workspace:*); LS suite 32/32.
<!-- SECTION:NOTES:END -->
