---
id: TASK-53
title: Register LUM6001 and align diagnostic docs topics
status: Done
assignee:
  - Photon
created_date: '2026-10-08 15:40'
updated_date: '2026-10-08 22:24'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while writing the docs (TASK-32). (1) LUM6001 (tsconfig missing options required by Lumen, spec §5.4 6xxx) is emitted by lumen check (packages/lumen/src/cli/check/tsconfig.ts, provisional) but is not in crates/lumen_compiler/src/diagnostics/registry.rs, so it has no generated page and lumen explain LUM6001 fails. (2) DiagnosticInfo::docs() returns diagnostics/<id>, while the generated pages live at packages/lumen/docs/errors/<id>.md and LumenError links https://lumen.dev/errors/<code>. lumen docs accepts both forms today, but the docs field should name the real topic. After changing the registry run pnpm --filter lumen docs:gen and fill the new page's explanation (the docs test fails while a code is undocumented).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LUM6001 is registered (6xxx tooling range) and docs/errors/LUM6001.md is written
- [x] #2 DiagnosticInfo::docs() returns errors/<id>, matching the docs path and LumenError URLs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Registry: LUM6001 'tsconfig missing options required by Lumen' (Warning, new 6xxx tooling and config range, as spec §5.4 lists); DiagnosticInfo::docs() returns errors/<id>. docs:gen + hand-written errors/LUM6001.md. Consumers updated in the same commit so tests stay green: lumen check's own diagnostics (cli/check/diagnostics.ts) use errors/<code>; check/mcp/compiler test expectations; napi + index.d.ts doc comments; cli/docs comment (lumen docs still accepts diagnostics/<id>); tsconfig.ts TODO removed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: done. Cross-area edits (mechanical consequences of the registry change, files clean at the time): Beacon's packages/lumen/src/cli/check/{tsconfig.ts (TODO comment), diagnostics.ts (docs topic), check.test.ts}, cli/mcp/mcp.test.ts and cli/docs/index.ts (comment); crates/lumen_napi/src/lib.rs and packages/compiler/index.d.ts were dirty with Halo's TASK-69 work, so only the one-line doc comment was committed (staged from HEAD + that line; Halo's hunks untouched). Evidence: lumen explain/docs resolve errors/LUM6001 (generated page with explanation); scanner test asserts docs() == errors/LUM1005; pnpm test 1039/1040 (the failure is src/server/contract.test.ts from Nova's in-progress server/render.ts, TASK-103); pnpm typecheck fails only in Spark's in-progress dom/insert-text.test.ts (TASK-90); pnpm lint clean; cargo test/clippy/fmt -p lumen_compiler green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM6001 (tsconfig missing options required by Lumen) is registered in a new 6xxx tooling range with a written docs page, and every diagnostic's docs topic is now errors/<id>, the real docs path (compiler, napi typings and lumen check's own diagnostics). lumen docs still accepts the old diagnostics/<id> form.
<!-- SECTION:FINAL_SUMMARY:END -->
