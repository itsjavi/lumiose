---
id: TASK-15
title: Compile async components and island call sites
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:29'
labels: []
milestone: m-2
dependencies:
  - TASK-9
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Async components and islands both need compile-time support: the await rewrite with replay keys, and island(ref, …) call sites with manifests (decisions 9 and 13, spec §4.4, §5.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 await is rewritten to $await only where the nearest function is the component; for await is supported; await using raises LUM1007; $component wrapping
- [x] #2 client:* usage compiles to island(ref, X, props, strategy, slot) on the server and is stripped on the client; LUM4001; the island manifest is emitted via the Vite plugin
- [x] #3 Golden fixtures
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared visitor (both targets), codegen/client/asyncs.rs: tag async component definitions with $async (declarations, export, export default, arrows/function expressions); rewrite awaits at the component's analysis sites to (await $await(() => e, N))(); lower for await at its site; wrap bodies in try/finally $leave(); LUM1007 for await using in analysis.
2. codegen/client/islands.rs: client:* directive on component elements; ref = <module>#<export> from the module's imports/exports (relative specifiers resolved against the module, root-relative with CompileOptions.root); server: island(ref, X, data props, strategy, value?, slots) with JSX-valued props and children as lazy slots; client: plain createComponent; LUM4001 when not an export; CompileMeta.islands for both targets (napi + wasm).
3. lumen/vite: pass root; island registry from every compile; virtual:lumen/islands manifest (ref -> lazy import), with a one-time scan of the root on first load (client build runs before the server build) and dev invalidation on new refs.
4. Goldens (async-components.tsx, islands.stsx, doc2-async), compile_api, Vitest server/client execution, plugin tests incl. a client build of the manifest.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: use the amended $await shape from doc-2 §4: (await $await(() => e, n))() plus try { … } finally { $leave() } around async component bodies.

Lux: emit $async(async function X …) around async component definitions (contract doc-2 §4); import $async from lumen/dom or lumen/server per target.

Photon (from TASK-9): analysis already records each component's await sites in source order (CompileMeta.components[].await_sites, AwaitExpression + for await), i.e. the site indices of the $await rewrite. In the client codegen, enter_component/leave_component (codegen/client/props.rs, called from visit_function/visit_arrow_function_expression in codegen/client/mod.rs) are the place to wrap the body in try/finally $leave(). client:* attributes are dropped from component props on the client today; awaited plain values (m.name in doc-2 §5.4) currently compile as dynamic member reads (insert(() => m.name)).

Photon (TASK-15 done):
- Async (both targets, contract doc-2 §4): async components are tagged `const X = /* @__PURE__ */ $async(async function X(props) { try { … } finally { $leave(); } })` (export → export const; export default named → const + export default X, anonymous → export default $async(…); arrow/function expressions wrapped in place; expression-bodied async arrows get a block body). Only awaits at the analysis' await sites (nearest function = the component) are rewritten: `(await $await(() => e, N))()`; nested async functions are untouched. `for await (left of it)` (also labelled, with continue) is lowered to a for(;;) over `(await $await(() => _iter.next(), N))()` with iterator return() on early exit; limitation: values of sync iterables are not awaited one by one. Hoisting note: tagged declarations are consts (TDZ instead of function hoisting). `await using` in a component → LUM1007 (analysis).
- Islands: `<X client:visible="200px" a={1} icon={<I/>}>{kids}</X>` → server `island(ref, X, { a: 1 }, "visible", "200px", { icon: () => …, children: () => … })` (data props keep getters/$$scope; slots are lazy arrows); value argument is `void 0` when only slots exist. ref = `<module>#<export>`: imports (named/default/namespace member `<ui.Tabs/>`) resolve relative specifiers against the module; local components must be exported (export decl, export { X as Y }, export default) else LUM4001 (falls back to createComponent). New CompileOptions.root (napi `root`): module ids inside it become root-relative (`/src/components/Team.stsx#TeamPanel`, as in doc-2 §5.5); the plugin passes Vite's root. Unknown or repeated client:* directives → LUM1002. Client output: client:* stripped, createComponent (nested islands render inline).
- CompileMeta.islands [{ ref, module, export, strategy, span }] from both targets (napi IslandMeta; wasm via serde).
- Island manifest: `virtual:lumen/islands` → `export default { [ref]: () => import(module).then((m) => m[export]) }` (sorted refs). Refs come from every compiled module plus a one-time scan (compile of every .stsx/.tsx under the root, skipping dot dirs/node_modules/dist/build/coverage) on first load, so the client build (which runs first) sees call sites in server-only route modules; in dev a new ref invalidates the manifest module. For Spark (TASK-18 loader): import the manifest from the island loader; for Nova (TASK-24/26): the loader must be a client entry so each island is its own chunk; island records' ref equals the manifest keys; islandUrl(specifier) receives the root-relative module id.
- Evidence: cargo test --workspace green, clippy/fmt clean; goldens async-components.{js,server.js}, islands.{js,server.js}, doc2-async (now matches doc-2 §5.4 structure); compile_api islands_are_reported_with_root_relative_refs. Vitest: server.test.ts renders async components (awaits, try/catch with rejection, for await) and islands (ranges, <template data-l-slot> for footer + children, records with props/slots/value and awaits {"0:0:0": 42}); execute.test.ts mounts an async component on lumen/dom and re-runs it on a prop change; plugin.test.ts serves the manifest with root-relative refs and a client build emits the island as its own chunk. pnpm typecheck clean, oxlint clean for my files, Playwright example still 6/6 (2 skipped by design). Release + WASI bindings rebuilt; wasi parity test passes.
- Not done / follow-ups: awaited plain values (m.name in doc-2 §5.4) still compile as tracked reads (correct, not optimal). Unrelated failing test seen: packages/lumen/src/cli/docs/examples.test.ts (Beacon, untracked WIP).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Async components compile on both targets per doc-2 §4 ($async tagging, $await site rewrite, for await lowering, try/finally $leave, LUM1007). client:* call sites compile to island(ref, X, props, strategy, value?, slots) on the server (JSX props and children as slots), stay plain component calls on the client, report LUM4001 for non-exports and appear in CompileMeta.islands; lumen/vite serves virtual:lumen/islands (ref -> lazy import) with root-relative refs. Goldens, Vitest execution (server + client) and plugin build tests.
<!-- SECTION:FINAL_SUMMARY:END -->
