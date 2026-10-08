---
id: TASK-50
title: 'Codegen: emit parentless branch and list values'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 14:11'
updated_date: '2026-10-08 16:50'
labels: []
milestone: m-1
dependencies:
  - TASK-49
priority: medium
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Use the runtime's parentless branch/list values (TASK-49) wherever codegen falls back to tracked functions today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Conditionals and .map() in component children, fragments and nested ternaries compile to branchValue/listValue; golden fixtures updated; execution tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
One codegen entry, live_value(): reactive conditional → branchValue(cond, () => a, () => b?), .map() rendering JSX → listValue(source, render, key?) (compile_list/compile_branch reused, selectors and key extraction included); the server emits its branch()/list() in the same positions so island markers match the client ranges. Call it from fragment items and component children (renderable / ssr_renderable), conditional arms (branch_arm, compile_value arms), and returns of components and row callbacks (compile_return, also for returned .map()). Goldens + execution test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (from TASK-18, hydration): the client now emits branchValue/listValue in value positions (children getters, fragments), but the server output still renders those as a plain ternary / `.map()` (e.g. `get children() { return on() ? ssr(_s2) : "inner no"; }`). Inside islands the server must emit `branch(cond, a, b)` / `list(source, render)` in exactly the positions where the client emits branchValue/listValue, so each value range gets its own `<!--[-->…<!--]-->` (or `<!--[!-->`) block: under hydration `branchValue`/`listValue` call `createRange(1)`, which claims the next server block at the cursor; with no block there the island falls back to a client render (LUM4006). Same for `.map()` in `<Suspense>`/component children. Hand-written server shapes that hydrate are in packages/lumen/src/dom/hydrate.test.ts ("parentless" cases).

Photon (session photon-task19-20261008T161409Z) claimed TASK-50.

**Done.** crates/lumen_compiler/src/codegen/client: idioms.rs `live_value`/`compile_arm` (branch_arm now always compiles arms through them; the old nested `() => () => cond ? a : b` and is_nested_reactive are gone), children.rs renderable, ssr.rs ssr_renderable, mod.rs compile_return/returns_list (component and row-callback returns, incl. `return xs.map(...)` and expression-bodied rows), compile_value arms; CLIENT_RUNTIME gains branchValue/listValue (contract order after branch). Other props (`title={open() ? <b/> : null}`) keep plain getters on purpose: a range is always truthy, so `if (props.title)` would change meaning; children are the contract's case. Plain non-component functions returning .map are untouched.

Before → after (client): `get children() { return open() ? _t0() : _t1(); }` → `return branchValue(open, () => _t0(), () => _t1())`; children/fragment `() => items().map(...)` / plain map → `listValue(items, render, key?)` (keyed, index accessor when used); nested ternary arm `() => () => …` → `() => branchValue(() => props.mode === "b", …)`; `return () => props.on ? … : …` → `return branchValue(() => props.on, …)`; row `(item) => () => active() > 0 ? (() => {…})() : _t5()` → `(item) => branchValue(() => active() > 0, () => {…}, () => _t5())`. Server: the same positions emit `branch(cond, …)` / `list(array, render)` instead of plain conditionals/arrays, so inside islands each value range has its `<!--[-->…<!--]-->` (or `<!--[!-->`) region (HTML outside islands unchanged).

**For Spark (TASK-18):** client ranges from branchValue/listValue now appear in component children, fragment items, branch arms and component/row returns; the server emits a branch/list region for each (goldens: branches, lists, values .server.js).

**Evidence.** Goldens: branches/lists (.js + .server.js) updated, new values.tsx (+ .js/.server.js); cargo test -p lumen_compiler green. packages/compiler execute.test.ts: new "parentless branches and lists" case on lumen/dom in happy-dom — memoised branch in children (unrelated write keeps the node), keyed listValue in children and in a fragment keeps row nodes on reverse, nested ternary a→b→c, component return toggles; 36/36 (+2 skipped). packages/lumen Vitest 683/684: the failure is src/dom/hydrate.test.ts "replays awaits…" (Spark's untracked TASK-18 WIP, edited 18:49; its source compiles without branchValue/listValue, so not this change).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Codegen emits the runtime's parentless values where it used to fall back to tracked functions or dead values: reactive conditionals and .map() lists in component children, fragment items, branch arms (nested ternaries) and component/row-callback returns compile to branchValue(cond, …)/listValue(source, render, key?) on the client — memoised on the condition, keyed with node reuse — and to branch()/list() on the server so island markers line up with the client ranges. Other props keep plain getters (a range is always truthy). Goldens updated plus a new values fixture; an execution test on lumen/dom covers children, fragments, nested ternaries and returns.
<!-- SECTION:FINAL_SUMMARY:END -->
