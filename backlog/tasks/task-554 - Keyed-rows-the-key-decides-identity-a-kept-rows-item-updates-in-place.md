---
id: TASK-554
title: 'Keyed rows: the key decides identity, a kept row''s item updates in place'
status: In Progress
assignee:
  - Spark
created_date: '2026-10-24 08:01'
updated_date: '2026-10-24 11:00'
labels:
  - runtime
  - compiler
  - diagnostics
  - docs
  - performance
dependencies:
  - TASK-553
priority: high
ordinal: 546000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Approved by the user as F1 (2026-10-24). packages/lumiose/src/dom/list.ts rebuilds a keyed row whenever row.item !== items[j], even when the key matches, so a refetch (new objects, same ids) or re-derived row entries recreate every row: DOM, components, local state and effects. React, Vue, Svelte, Angular and Lit keep a same-key row and update it; Solid 1.x <For> matches by reference (Lumiose's behaviour so far). Now the key alone decides whether a row is kept; a kept row's item is reactive like a prop (JSX bindings and effects that read it re-run); the index stays a signal; unkeyed lists keep matching by reference. Behaviour change for 0.7.0, recorded as decision-83.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In a keyed list a kept row whose item is a new object keeps its DOM, components, local state and effects, and its item updates reactively; unkeyed lists are unchanged
- [x] #2 The compiler makes reads of a keyed row callback's item parameter reactive, destructured item params included
- [x] #3 Setup-time reads of the item in a keyed row that JSX uses are reported by LUM2001 (and early returns on the item by LUM2003, as a warning per decision-77), with docs on reading the item in JSX/effects or putting the changing field in the key
- [ ] #4 decision-83 recorded (accepted, approved by the user on 2026-10-24), comparing React/Vue/Svelte/Angular/Lit and Solid 1.x <For>
- [x] #5 Docs (lists and keys, LUM2001/LUM2003 pages) updated, llms-full regenerated, docs:check green; @lumiose/ui and apps/web list callbacks checked
- [x] #6 pnpm check, cargo test/fmt/clippy, islands-e2e, spa-router-e2e and ui tests green
- [ ] #7 The js-framework-benchmark in-process A/B (unkeyed and keyed) shows no cost beyond noise on any operation; the rows microbenchmark (before/after, React as reference) and the size deltas are reported
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (standalone worker for Lux, who granted the compiler's list codegen for this task).

Runtime (packages/lumiose/src/dom/list.ts):
- With a key, the key alone decides whether a row is kept. A keyed row whose `render` declares the item is an `ItemRow` (a class that is also a trigger node: subs, subsTail, flags) and `render` receives the row; its `v` getter returns the current item and tracks the row. Reconciliation sets a kept row's new item and triggers it, instead of rebuilding the row. Unkeyed lists are unchanged (by reference, plain item).
- Lazy tracking: while a row is created, bindings that read `v` only join a list on the row through a new `n` field of render effects (null when in none), with no allocation; effects, computeds and later reads track. The row's first in-place change re-runs them (`rerun` in core/effect.ts) and they track from then on. Tried and dropped: an accessor closure per row (one closure + context per row tipped jsfb replace into an extra scavenge), tracking from every binding (+0.75 ms script per 1,000 keyed rows created, cold after jsfb's forced GC), re-running every binding under the row's owner (it re-created region content: 288 nodes per re-derive in the rows bench), one noted reader (others linked: +2 ms script on the rows replace).
- Contract (packages/lumiose/src/contract/client.ts, doc-2): keyed `list`/`listValue` take `render(row: { readonly v: T }, index)` and `key(item, index)`.

Compiler (crates/lumiose_compiler/src/codegen/client/row_items.rs, rows.rs, idioms.rs, props.rs, mod.rs, islands.rs):
- In keyed rows on the client, reads of the item become `item.v`; a destructured item param becomes `_item` with its bindings read as `_item.v.path` (defaults and array elements included); a pattern with a rest element, a computed key, a reassigned binding or a default for the whole item is read once (`let P = _item.v`). A render that reads no item (outside the key) and no index takes no parameter. The server keeps plain items.
- LUM2001 for keyed rows (both targets): setup declarators that read the item (calls of the app's own functions included; lumiose APIs, functions, JSX, new and await not) and that the row's JSX uses; copies of the key (`const id = row.id` with key `row.id`) are not reported; nor are values read only by handlers or by the key. LUM2001 also for item patterns read once. LUM2003 (warning) for early returns on the item, following derived locals.

Tests: list.test.ts (in-place updates, computeds/effects/later bindings, index key, nested lists, by-reference unkeyed), keyed-rows.test.ts (compiled: DOM, component state and effects kept; destructured params; data-slot handlers; nested lists re-derived; only characterData changes on in-place updates; dynamic content around nested bindings; unkeyed by reference), view-transition.test.ts; goldens keyed-rows.tsx (new), lists, row-data, row-keys, values; compile_api keyed_rows_report_setup_copies_of_the_item_and_early_returns_on_it.

Docs: concepts/jsx.md (Lists and keys, common mistakes, related diagnostics), errors/LUM2001.md and LUM2003.md (keyed rows), coming-from/react.md and solid.md (For, Index), llms regenerated. @lumiose/ui, apps/web, site-kit and examples: no keyed row reads its item at setup (no new diagnostic, no change needed).

Evidence: see decision-83 Consequences and TASK-555 (rows A/B: re-derive 11.9 → 0.1 ms script, refetch 12.4 → 1.7 ms, replace +1.2 ms; jsfb A/B unkeyed and keyed: every operation within noise). Size: typical imports 6.24 → 6.38 kB brotli (over the 6.25 kB soft target), islands page 9.40 → 9.59 kB (cap 10), whole runtime 13.78 → 13.96 kB (cap 15), list.ts 1552 → 1726 B brotli.
<!-- SECTION:NOTES:END -->
