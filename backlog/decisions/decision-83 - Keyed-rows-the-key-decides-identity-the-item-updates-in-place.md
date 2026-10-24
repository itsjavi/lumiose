---
id: decision-83
title: 'Keyed rows: the key decides identity, the item updates in place'
date: '2026-10-24 11:02'
status: accepted
---
## Context

A compiled `.map()` is a keyed list (decision-7): with a `key` on the element its callback returns, rows are matched by key, and without one by item reference. Until 0.6, a row whose key matched but whose item was a new object was rebuilt anyway (`packages/lumiose/src/dom/list.ts` compared `row.item !== items[j]`): its DOM, components, local state and effects were created again. Rows are setup-once and their callback received the plain item, so rebuilding was the only way to show the new item.

That made every refetch (new objects with the same ids) and every re-derived array of row entries rebuild every row. A port's virtual grid re-derives its visible rows (`{ key, index, row }` entries, new objects on every change) and rebuilt all 80 cards on each filter or search change, where the React original kept them. The investigation also found that the compiler dropped, without a word, keys that read a destructured item parameter, the index or a nested arrow's parameter (fixed first, TASK-553: those keys compile, and a key it cannot compile is LUM2008).

Other frameworks treat a key as the row's identity:

- **React**: a child with the same key and type keeps its component instance and state and re-renders with the new item.
- **Vue**: `v-for` with `:key` patches the element or component of the same key in place with the new item.
- **Svelte**: a keyed `{#each items as item (item.id)}` keeps the block of the same key and updates `item` in it.
- **Angular**: `@for (item of items; track item.id)` keeps the view of the same tracked value and updates its context with the new item.
- **Lit**: `repeat(items, (item) => item.id, template)` reuses the template instance of the same key and updates it with the new values.
- **Solid 1.x** `<For>` maps by reference: a new object is a new row, as in Lumiose so far. `<Index>` keys by position and gives each row its item as a signal.

## Decision

Approved by the user on 2026-10-24 (F1 of the row re-render investigation, after F3, TASK-553), for TASK-554.

- **The key alone decides whether a row is kept.** In a keyed list, a row stays while an item with its key is in the array. A kept row whose item is a new object keeps its DOM, components, local state and effects, and its item updates in place. Unkeyed lists keep matching by reference, unchanged. The index stays a reactive accessor.
- **The item is reactive, like a prop.** With a `key`, the runtime passes the row callback the row itself, whose `v` getter returns its current item (`list(parent, marker, source, render, key)` with `render(row: { readonly v: T }, index)`, only when `render` declares the parameter), and the compiler rewrites the callback's reads of the item: `item` becomes `item.v`, and the bindings of a destructured item, `({ id, name = "?", tags: [first] })`, become `_item.v.id`, `(_item.v.name === void 0 ? "?" : _item.v.name)` and `_item.v.tags[0]`. JSX bindings, component props (getters), effects and computeds that read the item re-run when it changes; event handlers and data-slot handlers read the current item. The key function still gets the plain item and the index (`(item, index) => key`). The server renders plain items.
- **The row is the item's reactive node, tracked lazily.** A keyed row is an instance of a small class that is also a trigger node (`subs`, `subsTail`, `flags`), so a row allocates neither a signal nor an accessor closure; reconciliation sets a kept row's new item and triggers it. Most rows never see their item change, and tracking it from every binding cost about 0.75 ms per 1,000 keyed rows created in js-framework-benchmark (an extra link per row, run cold after the benchmark's forced GC), and a closure per row tipped `replace` into an extra scavenge. So while a row is created, the bindings that read its item only join a list on the row, through a field every binding has (`n`), with no allocation; effects, computeds and every later read track it. When a row's item first changes in place, those bindings run again (`rerun` in core/effect.ts) and track it from then on. (Re-running every binding under the row's owner instead would also re-create the content of region bindings, whose compute renders JSX.)
- **Setup code reads the item once.** The callback still runs once per row. A value its setup code reads from the item (outside JSX and functions) that the JSX uses is a stale copy, reported by LUM2001; in a row, calls of the app's own functions count as reads (`const price = formatPrice(item.price)`), while calls of `lumiose`'s APIs (`signal(item.done)`, `untrack(…)`) are deliberate. An early return on the item is LUM2003, as a warning (the prop case of decision-77). Copies of the key (`const id = item.id` with `key={item.id}`) never go stale, since a different key is a different row. An item pattern the compiler cannot keep live (a rest element, a computed key, a reassigned binding) is read once from the row and reported by LUM2001. To make a new row when a field changes, put the field in the key.

## Consequences

- A behaviour change for 0.7.0, listed in its notes. Code that relied on a rebuild to reset a row's local state or re-run its setup when its item changed under the same key now keeps the row: such code puts the changing field in the key (``key={`${item.id}:${item.version}`}``). LUM2001 and LUM2003 point at setup code that reads the item.
- Refetches and re-derived row entries cost what changed. In the rows microbenchmark (`pnpm --filter @lumiose/bench-jsfb bench:rows:ab`, 10 rows of 8 cards, in-process A/B at 4x CPU slowdown, TASK-555), re-deriving the same items in new row entries went from 11.9 ms of script and 10 rows replaced to 0.1 ms and no DOM change, and a refetch of copies with the same ids from 12.4 ms to 1.7 ms (React with memoized cards: 0.6 ms for both). Replacing every row costs 1.2 ms more script (3% until painted): the cards read the item through component props, which are now getters.
- In js-framework-benchmark (in-process A/B, 20 alternating runs of every CPU benchmark), the official unkeyed app and a keyed variant (`key={row.id}`) stay within the noise of 0.6 on every operation.
- The client runtime grows by about 0.14 kB brotli for typical imports (6.24 to 6.38 kB, over decision-55's 6.25 kB soft target; the hard caps hold), and `list.ts` alone by 174 bytes.
- `key={i}` now gives an index-keyed list, like Solid's `<Index>`: rows keep their position and get each new item in place.
- The client contract's `list`/`listValue` take `render(row: { readonly v: T }, index)` and `key(item, index)` for keyed lists (doc-2). Hand-written callers of the runtime (tests) read `row.v`.
- The bindings created with a row read its item untracked until its first in-place change, which re-runs them once (one that stopped reading the item meanwhile runs once for nothing); bindings created later track the item from the start.
- The execution-contract hovers do not yet show a keyed row's item reads as tracked (TASK-556).
