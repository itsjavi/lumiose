---
id: TASK-565
title: 'Proposal: a headless virtualizer for @lumiose/ui'
status: Done
assignee:
  - Halo
created_date: '2026-10-24 15:40'
updated_date: '2026-10-24 17:53'
labels:
  - ui
  - proposal
dependencies: []
priority: medium
ordinal: 557000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A headless virtualizer for @lumiose/ui, from a port's three hand-written virtualizations (a window-scrolled grid of cards with measured row heights, a fixed-cell grid the server renders first, and an element-scrolled table with spacer rows). Headless core: window or element scroll; fixed, estimated or measured sizes; lists and row-based grids (columns given or from the container width); overscan; scroll-to-index; total size; stable keyed entries; one ResizeObserver for every measured row with batched size writes; server rendering of a first window that the client takes over without a layout jump or a hydration mismatch; list and table semantics (aria-rowcount/aria-rowindex, aria-setsize/aria-posinset). New public API: the user approves its shape before it is merged or published (AGENTS.md). Prototype on Halo's worktree branch, validated on a local virtualizer-trial branch of the port.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The proposal records the API sketch, the alternatives (primitive, components, both) and their trade-offs
- [x] #2 A prototype with unit and ui-e2e tests and a draft docs page sits on Halo's worktree branch, unmerged
- [x] #3 The port's three virtualizations run on the prototype on a local branch, with its checks green and a matrix against the hand-written versions and the original
- [x] #4 The user chose an API (or declined), recorded in a decision
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Proposal (Halo, 2026-10-24). Prototype on Halo's worktree branch (worktree-agent-adf88b26c7c79b8a0), unmerged; docs draft packages/ui/docs/virtualizer.md.

API sketch (`@lumiose/ui/virtualizer`, also from `@lumiose/ui`):

```tsx
const grid = createVirtualizer({
  count: () => items().length,        // Value<number>: a value or an accessor
  size: 48,                           // px per row: fixed, or the estimate until measured; (row) => px
  columns: { minWidth: 192, min: 1 }, // or a number / accessor; default 1 (a list)
  gap: 16, columnGap: 16,             // between rows / columns
  overscan: 4,                        // rows past each edge
  scroller: () => el,                 // default: the window
  initial: 20,                        // items rendered before mount (server + hydration)
  keepFocused: false,                 // keep the focused [data-row] rendered (placed rows only)
});
<div ref={grid.container} style={{ position: "relative", height: `${grid.total()}px` }}>
  {grid.rows().map((row) => (
    <div key={row} data-row={row} attach={[grid.measure]}
         style={{ position: "absolute", inset: "0 0 auto", transform: `translateY(${grid.start(row)}px)` }}>
      …items of the row, keyed by id…
    </div>
  ))}
</div>
```

Members: container (ref), measure (attach; reads data-row), rows() / items() (index arrays that keep their identity while the window stays), range() ({start,end} items, for slice), start(row), size(row), total(), before() / after() (spacers or padding for rows in flow), columns(), width(), itemWidth(), mounted(), scrollToIndex(index, { align: auto|start|center|end, behavior }) (honours scroll-padding, re-checks for a few frames while rows measure).

Built-in lessons: one ResizeObserver for every measured row, one size write per observer callback; nothing measured in attach; index arrays stable across measurements and scrolls inside the overscan (computed equality), so no list re-render; measured sizes reset (and rendered rows re-observed) when the column count changes; the pre-mount window reads nothing from the browser, so server and hydration render the same rows and the island takes the same keyed elements over.

Alternatives:
- A. Primitive only, createVirtualizer() (prototyped). Fits every layout seen in the port: rows placed by transform, cells placed in a grid, and table rows in flow between spacer rows (a <tr> cannot be wrapped or placed). The app's own keyed .map() keeps decision-83's identity rules; no wrapper element; 1.52 kB brotli. Cost: the app writes the positioning, the container height and the ARIA itself.
- B. Components only (<Virtual.List each key>{(item) => …}</Virtual.List>, Virtual.Grid, Virtual.Table). Less boilerplate and ARIA built in, but a render-prop child needs a wrapper element per item to carry the key and the position, tables need their own component (tbody, spacer rows, aria-rowindex), each layout (placed or in flow, rows or cells) is another component or prop, and the SSR switch becomes an opinion. Bigger, and still built on A.
- C. Both: A now, then thin components over it if apps repeat the same boilerplate. Recommended.
- D. A server-rendered <lu-virtual-list> element with a ?client script (decision-62/63 style): rejected. Rendering a window needs the data in the browser; hiding server-rendered rows saves no DOM, and CSS content-visibility: auto with contain-intrinsic-size already skips off-screen rendering with no script (documented as the no-JS path).
- E. Wrap TanStack Virtual's core: rejected. A larger dependency, its own measuring and item objects, and no notion of Lumiose's pre-mount window or keyed takeover.

Open questions for the user:
1. The name and home: createVirtualizer (as createContext) or virtualizer() (as signal/resource); @lumiose/ui/virtualizer, or lumiose core since it renders no UI.
2. Index arrays (rows()/items() of numbers: no allocation, stable) or entry objects ({ index, start, size, key }, as TanStack's getVirtualItems()).
3. data-row as the measured/focused row's attribute (TanStack uses data-index).
4. keepFocused default false (it is only right for placed rows), or true.
5. Components (option C) now, later or never.
6. The docs page is a guide (## Usage), so the MCP ui catalog leaves it out: Beacon to decide how primitives appear there.
7. Not in scope: horizontal virtualization, sticky rows, reverse (chat) lists, masonry lanes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo, 2026-10-24: prototype, docs draft and ui-e2e on Halo's worktree branch (commits 49914839, 24ec24bb, f0fd4a46, 947dd92c), not merged.

- Files: packages/ui/src/virtualizer/virtualizer.ts (+ virtualizer.test.tsx server, virtualizer.dom.test.tsx happy-dom), the `./virtualizer` export and the index re-export, a size.ts row, packages/ui/docs/virtualizer.md (a guide page: `## Usage`, since the MCP ui catalog reads `## Anatomy` pages as components), examples/ui-e2e routes /virtualizer and /virtualizer/grid with three islands, e2e/virtualizer.e2e.ts.
- Size: 3.33 / 1.67 / 1.52 kB (min / gzip / brotli), no script, no CSS.
- Checks: ui unit 634/634 (9 new); ui typecheck; cli docs tests 10/10 (the three `tsx check` examples type-check); docs:check; oxlint and oxfmt on the changed files; ui-e2e virtualizer suite 40/40 (Chromium dev and build, Firefox, WebKit); the example's `lumiose check`.
- Found in ui-e2e: on the measured grid, Vite's dev overlay logs "ResizeObserver loop completed with undelivered notifications" (rows measured in the frame they render, and rows the move adds measured next frame). Harmless, documented; the hand-written grid has the same design. Deferring writes to the next frame would avoid it at the cost of one frame at estimated positions (an open question).

Port trial (local branch `virtualizer-trial` of the port, commits a5d21bc and 5cb1276, never pushed, main untouched; built from a worktree with a pnpm override to the packed @lumiose/ui, the override not committed):
- Diff: 3 files, 109 added, 297 removed (VirtualGrid 25/141, DexGrid 49/106, PokemonTable 35/50).
- Checks: lumiose check 0 errors (the 24 old warnings), lint, build, unit 30/30, the tracker's e2e 9/9, behaviour 19/19 against the original, visual diff identical to 0.7.0's on all 14 pairs (0.03-0.3%), the row-placement probe; on the tracker the first server cell is the same element after mount (the hand-written grid renders a second list).
- Matrix (in one session, builds alternating; both port builds on Lumiose packed at 49914839; data on the branch in docs/parity/matrix/2026-10-24-virtualizer/): original / hand-written (82f4a12) / prototype (a5d21bc):
  - JS list / detail / tracker: 390.4 / 423.8 / 388.3; 37.5 / 22.3 / 32.9; 38.2 / 22.3 / 34.0 kB.
  - List search, clear, filter on / off, from the DOM change: 215, 236, 123 / 112; 212, 217, 94 / 84; 206, 183, 63 / 54 ms. Settled: 158, 266, 180 / 150; 172, 193, 71 / 67; 158, 151, 41 / 38 ms. Long tasks: 0, 78, 83 / 79; 0, 0, 62 / 59; 0, 0, 0 / 0 ms. Clear and the filter switch do not overlap run to run. Likely causes, not separated: rows keyed by index keep their elements, and a filter no longer resets the measured heights.
  - Tracker interactions (DOM): 15, 13, 47, 70, 63, 67; 5, 4, 9, 27, 22, 23; 5, 4, 9, 25, 17, 19 ms.
  - Slow 4G list shows / interactive: 1.39 / 8.20; 0.64 / 4.06; 0.66 / 4.16 s. Tracker shows / LCP / works: 1.66 / 8.16 / 10.40; 0.66 / 2.59 / 2.10; 0.59 / 2.56 / 2.55 s.
  - The tracker's +0.45 s: the mount costs the same (5-run probe: marker 2.05 against 2.30 s, long tasks 161 against 151 ms); the virtualizer is a chunk shared by two islands that arrives last in the island's import waterfall (2.20 s against 1.88 s). The island's imports start loading only after its own chunk (a waterfall): a possible framework or chunking task (Nova), not a virtualizer cost.

User decisions (2026-10-24): createVirtualizer, in @lumiose/ui (`@lumiose/ui/virtualizer`); rows() returns index arrays; rows are measured in the same frame; and ship components now too, on top of the primitive (Virtual.List / Virtual.Grid / Virtual.Table or similar). The components' API shape and the remaining details (data-row vs data-index, keepFocused's default) come back to the user before merging.

Halo, 2026-10-24 (components, after the user's decisions): VirtualList, VirtualGrid and VirtualTable on createVirtualizer, on Halo's worktree branch (commits 13a09ab8, c209bed7, 52b3501f, 93105a15), not merged. Their API waits for the user's sign-off.

- API: `<VirtualList|VirtualGrid|VirtualTable items itemKey size [measure] [overscan] [scroller] [initial] [virtualizer]>{(row) => …}</…>`; the list adds `gap`, `keepFocused` (default true), `itemProps`; the grid adds `minItemWidth` / `minColumns` or `columns`, `gap`, `columnGap`, `keepFocused` (default true), `itemProps`; the table adds `head`, `headerRows` (default 1), `colSpan`, `empty`, `rowProps`. Each renders its container (ul, ul, table) and one element per item (li, li, tr) with the key, the place, data-row and the ARIA (aria-posinset/aria-setsize; aria-rowcount on the table, aria-rowindex on its rows); the children function renders the content once per row, with `row.item` and `row.index` as getters. Rows are keyed by itemKey against the window's items (an array of the items, not of indexes), so decision-83's identity holds.
- Primitive changes: `overscan` takes an accessor; several measured elements of one row (a grid's cells) make the row as tall as the tallest.
- Sizes (brotli, with the primitive): virtualizer 1.56, VirtualList 2.18, VirtualGrid 2.25, VirtualTable 2.26 kB.
- Two Lumiose bugs found, with tasks and workarounds in the components: TASK-567 (Spark) a keyed row's binding that reads the item and an unchanged computed misses the in-place update (each row's item goes through a computed); TASK-568 (Photon) `attach` next to a spread becomes an attribute and never runs (measured rows are observed from the container).
- Tests: ui unit 645/645 (16 for the virtualizer and components); ui typecheck; docs examples and contract 10/10; docs:check. ui-e2e (virtualizer and components suites) 83 passed and 1 skipped (macOS WebKit's Tab, which Linux CI runs) in Chromium dev and build, Firefox and WebKit, axe in both schemes included.
- Docs: virtual-list.md, virtual-grid.md, virtual-table.md as component pages (the MCP ui catalog lists them as "Virtual List.VirtualList" and so on, like "Toggle Group.ToggleGroup"); virtualizer.md stays a guide for the primitive and points at them.
- Demos: the ui-e2e fixture's /virtualizer/components (list and table), /virtualizer/components/cells (server-rendered fixed cells) and /virtualizer/components/cards (measured).

Port trial with the components (local branch `virtualizer-trial`, def9307 and 497f59d; main untouched): the list's measured grid and the tracker's fixed grid are VirtualGrid, the table is VirtualTable (the port has no plain list, so VirtualList is covered by ui-e2e only).
- Diff against the hand-written grids (82f4a12): 251 added, 501 removed (primitive trial: 109 / 297).
- Checks: lumiose check 0 errors (the 24 old warnings), lint, build, unit 30/30, the tracker's e2e 9/9, behaviour 19/19, visual diff equal to 0.7.0's on all 14 pairs once cells take their column as `left` (52b3501f; a translated x blurred the cards' edges, 0.22 to 0.32% on the desktop list), the row-placement probe, and the tracker's first server cell kept after mount.
- Matrix (one session, builds alternating, all on Lumiose packed at 52b3501f; data in docs/parity/matrix/2026-10-24-virtual-components/), original / hand-written / primitive / components:
  - JS list / detail / tracker: 390.4 / 423.8 / 388.3; 37.5 / 22.3 / 32.9; 38.2 / 22.4 / 34.1; 38.9 / 22.3 / 34.9 kB. Tracker HTML 13.0; 17.6; 17.6; 18.1 kB (each server cell gains its li with data-row and the aria attributes).
  - List search, clear, filter on / off from the DOM change: 221, 238, 119 / 114; 216, 214, 106 / 88; 208, 186, 65 / 55; 202, 194, 55 / 48 ms. Settled: 159, 265, 157 / 154; 174, 187, 80 / 70; 160, 152, 42 / 38; 159, 155, 36 / 31 ms. Long tasks: 0, 81, 80 / 81; 0, 0, 68 / 60; 0, 0, 0 / 0; 0, 0, 0 / 0 ms.
  - Components against the primitive: the runs overlap on every list and tracker interaction (no difference claimed). Both beat the hand-written grids on clear and the filter switch, without overlap.
  - Slow 4G tracker works: 10.38; 2.08; 2.55; 2.65 s, the shared chunk's place in the island's import waterfall, as before (TASK-566).

Recommendations for the user's sign-off: keep `data-row` (the virtualizer's unit is the row; a grid's cells carry their row, which measuring and keepFocused need; the components write it themselves); keepFocused defaults to true on VirtualList and VirtualGrid (placed rows), false on the primitive (it cannot know the layout), and VirtualTable has none (rows in flow); in the MCP ui catalog the three components are component pages and the primitive a guide page.

Halo, 2026-10-24: the user approved the components' API as sketched and the three details (data-row, keepFocused on by default for VirtualList and VirtualGrid and off for the primitive, none on VirtualTable; the components as component pages in the MCP ui catalog and the primitive as a guide), recorded by Lux in decision-84. The docs, demos and sources drop their proposal wording and cite decision-84 (60e752db). Done on Halo's branch, unmerged: Lux merges after the 0.7.1 fixes TASK-567 and TASK-568, and the components' workarounds for them go in a follow-up.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
createVirtualizer() and VirtualList, VirtualGrid and VirtualTable on it, in @lumiose/ui/virtualizer (decision-84): headless windowing for the window or an element, fixed, estimated or measured rows, auto-fill grids, server-rendered first windows the islands take over, and list and table ARIA. Brotli: 1.56 kB primitive, 2.18 to 2.26 kB with a component. Unit and ui-e2e tests in Chromium, Firefox and WebKit, four docs pages. In the port's local trial branch the components replace three hand-written virtualizations (251 lines added, 501 removed) with every check green, and its list interactions run faster than the hand-written grids in an alternating matrix.
<!-- SECTION:FINAL_SUMMARY:END -->
