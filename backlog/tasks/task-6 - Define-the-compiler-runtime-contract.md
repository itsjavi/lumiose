---
id: TASK-6
title: Define the compiler-runtime contract
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:57'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-2 - Compiler-runtime-contract.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon (compiler) and Spark (runtime) work in parallel. The exact set of runtime functions that compiled code imports, with their semantics and golden input/output examples, is the interface between them, so it must be fixed before codegen and runtime implementation diverge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A backlog doc lists every runtime import used by client, hydrate and server output, with signatures and semantics
- [x] #2 A typed stub module in packages/lumen declares these functions, so compiled output type-checks against it
- [x] #3 Golden examples (.stsx in, client/server JS + CSS out) cover templates, bindings, events, lists, branches, selector, components and props, styles and $refs, async/$await, islands
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Design the client, server and hydration runtime surface that compiled output imports, with signatures and semantics.
2. Write it as backlog doc-2 with golden examples.
3. Add typed interfaces in packages/lumen/src/contract/ that the runtime must satisfy and the compiler targets.
4. Amend spec §5.2/§7.4: one compiled walk, with hydration claiming pluggable through lumen/dom/hydrate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contract published as doc-2 with typed interfaces in packages/lumen/src/contract/{client,server}.ts; lumen/dom/hydrate subpath export added. Architect amendments to spec v0.3: hydration uses one compiled walk plus a pluggable claim cursor (no separate _tN.h walk); $await takes a static site index; createComponent detects async components (no $component wrapper). Spec doc-1 updated accordingly. Verified: TS 7 typecheck of the contract modules passes and the contract import test passes.

Contract amendment (Lux, from Spark's TASK-7 finding): $await now returns Promise<resume>, the compiled shape is (await $await(() => e, n))(), and async bodies get try/finally $leave(). Updated in client.ts, server.ts, doc-2 §2-§5 and spec doc-1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Defined the compiler-runtime contract: doc-2 gives semantics and golden examples (counter, keyed list with selector and data-slot events, component props/children/class passthrough, async component, island call site), and packages/lumen/src/contract/{client,server}.ts give the typed ClientRuntime/ServerRuntime surfaces that runtime and compiler must satisfy. Verified by TS 7 typecheck and the contract test.
<!-- SECTION:FINAL_SUMMARY:END -->
