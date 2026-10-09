---
id: TASK-63
title: Expose execution-contract meta from the compiler
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 16:03'
updated_date: '2026-10-09 04:25'
labels: []
milestone: m-4
dependencies:
  - TASK-45
priority: low
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The language server can show per-expression execution contracts in hovers (tracked, untracked, once or deferred: spec §5.1), but compile() meta has no such data. Beacon proposed the shape in TASK-48.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CompileOptions.contract?: boolean; CompileMeta.contract?: Array<{ span, kind: tracked|untracked|once|deferred, site: child|attribute|prop|event|…, component?, via?, reads?: Span[] }> with UTF-16 spans through napi
- [x] #2 Golden fixtures; the language server shows the contract in hovers (Beacon follow-up note)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): CompileOptions.contract (napi/wasm: contract?: boolean) fills CompileMeta.contract?: Array<{ span, kind: tracked|untracked|once|deferred, site: child|attribute|property|class|style|prop|event|ref|spread|await, component?, via? (insert/branch/list/setAttr/setProp/setClass/setStyle/getter/useRef/attach/bindValue/delegateEvents/listen/spread/mergeProps/$await), reads: Span[] }>, sorted by start (outer first; entries nest, hover the innermost). UTF-16 spans through napi. Classification (codegen/client/contract.rs) mirrors client codegen: tracked = is_dynamic (shared DynamicFinder) or a reactive read incl. destructured props; untracked = calls untrack(); once otherwise; events/refs deferred; component props/children 'getter' when tracked. reads come from analyze::reactivity::reactive_reads (first_reactive_read now uses it). Golden table in crates/lumen_compiler/tests/compile_api.rs; JS test packages/compiler/test/compile.test.ts. Beacon follow-up (not done): language-server hover = innermost meta.contract entry containing the cursor, compiled with { contract: true }.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
compile() exposes per-expression execution contracts (opt-in contract option; kind/site/component/via/reads, UTF-16 spans via napi and wasm). LS hovers are Beacon's follow-up.
<!-- SECTION:FINAL_SUMMARY:END -->
