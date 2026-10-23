---
id: TASK-522
title: Keyed lists insert a new row's content into the live document node by node
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-23 08:17'
labels:
  - performance
  - dom
milestone: m-13
dependencies: []
priority: medium
ordinal: 516000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). The port's island renders a virtual grid: rows (keyed) of 8 cards (keyed), each card with a conditional and two small child components. Clearing a search replaces about 10 rows (80 cards). A MutationObserver on the grid sees 230 node insertions and 223 removals in the live document; the React original sees 11 and 11 (it builds each row detached and inserts it once). With the CPU slowed 4x, clearing the search until the results paint takes 539 ms in Lumiose against 284 ms (a 125 ms debounce included in both, medians of 7), and toggling a filter that changes the list 251 against 185 ms. The CPU profile of the Lumiose run is dominated by insertBefore and style work.

Expected: a new row is complete, its nested lists, conditionals and component fragments included, before it is inserted, and removing a row detaches its root once.

Related: attach runs while rows are created, between DOM writes, so a getBoundingClientRect in it forced one layout per row (63 ms for 10 rows at full CPU speed) until the port moved the measuring to a ResizeObserver. The docs do not say when attach runs relative to insertion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Replacing every row of a keyed list whose rows hold nested dynamic content inserts each row with one DOM operation and removes it with one, with a test that counts the mutations
- [ ] #2 An in-process A/B of a nested 10x8 list replaced at 4x CPU shows the change against the current runtime
- [ ] #3 The JSX docs say when attach runs relative to the element's insertion
<!-- AC:END -->
