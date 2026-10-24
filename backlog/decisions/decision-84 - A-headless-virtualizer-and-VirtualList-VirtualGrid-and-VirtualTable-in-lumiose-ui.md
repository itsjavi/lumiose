---
id: decision-84
title: >-
  A headless virtualizer and VirtualList, VirtualGrid and VirtualTable in
  @lumiose/ui
date: '2026-10-24 17:50'
status: accepted
---
## Context

A port of a real app wrote three virtualizations by hand: a window-scrolled grid of cards with measured rows, a grid of fixed cells rendered on the server, and a table of rows in flow. The keyed-rows investigation (decision-83) showed how easy they are to get wrong:

- entries and keys must be stable;
- one ResizeObserver should measure every row;
- size writes must be batched;
- nothing should be measured per row in `attach`.

Lumiose and @lumiose/ui had no virtualization. Halo prototyped a primitive (TASK-565), proved it in the port and then built components on it.

## Decision

Approved by the user on 2026-10-24 (TASK-565).

- **`createVirtualizer()` in @lumiose/ui** (`@lumiose/ui/virtualizer`, also exported from `@lumiose/ui`). It is a headless primitive:
  - **Scrolling:** the window or an element.
  - **Sizes:** fixed, estimated or measured.
  - **Layouts:** lists and grids (a column count from the container width or given), with overscan and `scrollToIndex`.
  - **Rows:** `rows()` returns index arrays whose identity holds while the window stays.
  - **Measuring:** in the same frame as placement, with one ResizeObserver.
  - **Server rendering:** the server renders a first window that the island takes over.
- **`VirtualList`, `VirtualGrid` and `VirtualTable`**, built on the primitive.
  - **Props:** `items`, `itemKey`, `size` and `initial`, plus layout props.
  - **Children:** a children function gets `row.item` and `row.index` as getters.
  - **Rendering:** each component renders its container and one element per item, with the key, the position and the ARIA attributes. Tables keep table semantics.
  - **Exports:** they are separate exports, not a `Virtual.*` namespace, so each one tree-shakes.
- **Details:**
  - rendered rows carry `data-row`, the row and not the item index;
  - `keepFocused` is on by default for VirtualList and VirtualGrid, and off for the primitive;
  - the components are component pages in the MCP UI catalog, and the primitive is a guide page.

## Consequences

- **Size (brotli):** the primitive is 1.56 kB; each component is 2.2 kB with the primitive included.
- **Keyed rows (decision-83):** a refetch with the same ids keeps every row, its DOM and its state.
- **In the port:** the components replaced the three hand-written grids, adding 251 lines and removing 501. The filter switch went from about 106 to 55 ms at 4x CPU, with no long tasks, and visual and behaviour parity held.
- **Bugs found while building it, worked around in the components and being fixed for 0.7.1:**
  - TASK-567: a keyed-row binding misses an in-place update when it also reads a computed that did not change;
  - TASK-568: `attach` next to a spread is dropped.
- **Loading order (TASK-566):** a shared virtualizer chunk loads last in an island's import chain. Until the fix lands, that delays when a slow-4G page becomes interactive.
- **Out of scope for now:** horizontal virtualization, sticky rows, reverse (chat) lists and masonry layouts.
