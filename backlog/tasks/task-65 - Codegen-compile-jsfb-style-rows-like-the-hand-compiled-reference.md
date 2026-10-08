---
id: TASK-65
title: 'Codegen: compile jsfb-style rows like the hand-compiled reference'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 16:10'
updated_date: '2026-10-08 21:05'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The compiled js-framework-benchmark app (benchmarks/js-framework-benchmark, krausest `lumen`) uses 0.37 MB more run memory than the hand-compiled reference (`lumen-hand`, src/hand-compiled.js) and misses the spec memory target (2.87 vs ≤ 2.7 MB). Found by Spark in TASK-12; RESULTS.md has the numbers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In .map() callbacks, consts initialised from row data without calls (const id = row.id) count as row data: selector hoisting and data-slot event hoisting apply (doc-2 §5.2)
- [x] #2 Plain-value text children ({id}) compile to a one-time write into a template text placeholder (doc-2 §5.4) instead of a static insert
- [x] #3 Dynamic text children ({row.label()}) avoid a region and a created text node per row (template placeholder plus a text binding; Spark adds a runtime helper with an insert fallback for non-text values if the contract needs one)
- [ ] #4 pnpm bench:jsfb: lumen run memory ≤ 2.7 MB and CPU within 2 % of lumen-hand
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. AC#1 in codegen (idioms.rs/events.rs): detect row consts (top-level const of the .map callback, identifier or simple object destructuring, initialiser without calls/writes/functions reading only the item, earlier row consts and outer bindings); selectors treat them as the item; data-slot hoisting passes the one row value the handler reads (item or a row const) through $$xData. Golden row-data.tsx.
2. benchmarks App.stsx back to the idiomatic const id = row.id form (as in hand-compiled.js).
3. Measure: local JS-heap probe (old/new/hand), then krausest bench:jsfb for lumen and lumen-hand.
4. AC#2/#3 need a runtime text helper with an insert fallback and a matching server text hole (contract change): propose, decide with Lux/Spark.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reviewed and assigned to Photon. The compiled js-framework-benchmark run uses 2.87 MB vs 2.50 MB hand-compiled, against a 2.7 MB target. Do this after TASK-45/52, before TASK-50.

Photon (session photon-task19-20261008T161409Z) claimed TASK-65.

**AC#1 done** (crates/lumen_compiler/src/codegen/client/idioms.rs, events.rs): MapCtx.row_consts = the callback body's top-level consts whose initialiser is row data (no call/new/tagged template/await/yield/assignment/update/delete/function/class/JSX; references only the item, earlier row consts or bindings outside the callback — the index and other locals disqualify), bound as an identifier or a simple object pattern ({ id, label: text }, no defaults/rest/computed keys). Selector keys (RefChecker.row_data) count them as the item (`selected() === id` → `_isSelected(id)`); key functions do not (they only receive the item). Captures records the single row value a handler reads (item or one row const) → hoisted `(id) => select(id)` + `$$clickData = id`; a handler reading two row values (row and id) keeps its per-row closure. New golden tests/fixtures/client/row-data.tsx (+ .js/.server.js); all goldens unchanged otherwise. napi rebuilt.

benchmarks/js-framework-benchmark/src/App.stsx now uses `const id = row.id` (the form hand-compiled.js documents). Compiled row: `let t=e.id … z(n,()=>m(t),nn), St(r,t), a.$$click=rn, a.$$clickData=t, St(a,()=>e.label()), o.$$click=an, o.$$clickData=t`.

**Local probe** (scratch, Chrome 154 headless, performance.memory after gc(), 9 runs, identical medians): JS heap after run 1k — old App/old codegen 2.094 MB, new 1.890 MB, hand 1.724 MB. The old→hand gap (0.37) equals krausest's 2.87→2.50, so krausest run memory ≈ 2.67 MB expected. Remaining 0.17 MB = `insert(_a, () => row.label())` (region + closure) vs hand `bind(_a.firstChild, row.label, setText)`.

**AC#2/#3 (needs a decision):** `{id}` / `{row.label()}` are not provably text (an identifier or call may hold a Node/array/JSX: `const icon = <Icon/>; … {icon}`), so a placeholder + setText/.data write is unsound without a fallback. Options: (A) contract change — Spark adds an apply helper `text(node: Text, value)` (primitive → data, nullish/boolean → "", otherwise render through a region kept before the node) usable for one-time writes and `bind(_t, () => row.label(), text)`; the server emits a text hole that falls back to a marked region for non-text values so islands still hydrate; I switch sole non-provable children to it. (B) runtime-only — insert() of a function whose value is text keeps a light text binding and upgrades to a region on the first non-text value (no codegen/contract/hydration change; keeps the closure). AC#2 alone saves ~0 memory (static insert already creates one text node, no region). The full run that started 18:38 (someone else's `jsfb.ts --count 10 --mem-count 3`) already builds this codegen; its numbers will close AC#4.

Photon — RESUME (checkpoint, In Progress).
Done: AC#1 (row consts) + golden row-data.tsx; App.stsx uses const id = row.id; napi rebuilt. Local probe: JS heap after run 1k 2.094 → 1.890 MB (hand 1.724).
Pending: AC#4 numbers — the full krausest run started 18:38 by another session (log: <Lux scratchpad>/full-run.log, writes benchmarks/js-framework-benchmark/RESULTS.md) already builds this codegen (bundle shows a.$$clickData=t). Next: read lumen vs lumen-hand run memory (22_) and CPU from that RESULTS.md; tick AC#4 if ≤ 2.7 MB and CPU within 2 %. The previous RESULTS.md is backed up at <Lux scratchpad>/RESULTS.orig.md.
Blocked/decision: AC#2/#3 need the runtime text helper (option A, contract change, Spark + server text hole) or the runtime-only insert optimisation (option B) — see notes above; ask Lux to decide/split.
Files: crates/lumen_compiler/src/codegen/client/{idioms,events}.rs, tests/fixtures/client/row-data.*, benchmarks/js-framework-benchmark/src/App.stsx.

Photon (2026-10-08, resumed; Lux's call on AC #2/#3: implement for values that are provably text). Commit f34bebe.
- children.rs/ssr.rs: the text-node path (template text placeholder + bind(setText) when reactive, one-time .data write otherwise; server text() hole) now applies to any dynamic child with no text or dynamic sibling next to it (is_isolated), not only sole children. Next to JSX text or another dynamic child it stays insert: a placeholder would merge with the neighbour text when the template (or the server HTML) is parsed.
- 'Provably text' widened: a const initialised with a text-like expression (or another such const) counts (children::text_consts, shared by both targets), e.g. const label = row.name.toUpperCase(); <li>{label}</li> -> _text.data = label.
- Soundness limit (why AC #2/#3 are ticked only in this scope): {id} with const id = row.id and {row.label()} are not provably text (could be null/boolean -> renders nothing, a Node/array, or a function/signal that insert tracks), so jsfb rows still compile to insert(_td, id) and insert(_a, () => row.label()). Closing that gap needs option A from the notes above (runtime text helper with an insert fallback + server hole: contract change for Lux/Spark).
- Verified: goldens text-children (new) + bindings/implicit-tbody/lists updated; packages/compiler parity (Texts with 'A' and '') and execution tests; hydration of isolated text nodes checked with a throwaway hydrate test (incl. empty values, no mismatch warnings; Spark may add such a case to dom/hydrate.test.ts); lumen_wasm test updated. jsx.md compiled-idioms row documents it (docs:check green).
- Contract doc-2 §3 'Template/server alignment' (Lux): a text-like child alone between nodes is now a client text node / server text() hole, not only a sole child.
- AC #4 left unchecked: run pnpm bench:jsfb (lumen vs lumen-hand run memory + CPU) on a quiet machine; expected run memory ~2.67 MB from the AC #1 probe, and these text changes do not touch the jsfb rows.

Lux: option A approved. Spark implements the runtime helper (new task), and you then emit it for maybe-text children in rows (AC #2/#3). AC #4 waits for a quiet-machine benchmark run.
<!-- SECTION:NOTES:END -->
