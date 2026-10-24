---
id: TASK-565
title: 'Proposal: a headless virtualizer for @lumiose/ui'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-24 15:40'
updated_date: '2026-10-24 15:40'
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
- [ ] #1 The proposal records the API sketch, the alternatives (primitive, components, both) and their trade-offs
- [ ] #2 A prototype with unit and ui-e2e tests and a draft docs page sits on Halo's worktree branch, unmerged
- [ ] #3 The port's three virtualizations run on the prototype on a local branch, with its checks green and a matrix against the hand-written versions and the original
- [ ] #4 The user chose an API (or declined), recorded in a decision
<!-- AC:END -->
