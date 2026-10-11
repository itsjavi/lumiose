---
id: TASK-240
title: >-
  Stack table: a Server speed group (rendering and requests) replaces 'same
  components'
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-11 03:48'
updated_date: '2026-10-11 03:55'
labels:
  - site
milestone: m-7
dependencies: []
priority: high
ordinal: 242000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment). Replace the column 'Interactive parts use the same components' with a 'Server speed' group header spanning two sub-columns. 'Rendering': renders/s of the SSR benchmark page (benchmarks/ssr results; React's entry for both React rows). 'Requests': req/s of the fullstack comparison's home page (server.home.rps). Map the new sources ahead of their results so TASK-235 only commits data: SSR entries for Preact, Astro and Remix 3 (TASK-241), and the fullstack Astro app (TASK-242). Preact's Requests cell is the fact 'No full-stack layer'. Astro's caveat moves to a note under the table: 'Astro's interactive islands need a second UI framework.' Units are explicit (renders/s, req/s), and the note says where each number comes from. Update tests and the axe suite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The table shows a 'Server speed' group with 'Rendering' (renders/s) and 'Requests' (req/s) sub-columns, filled from committed results, with 'measuring' where a result is pending
- [ ] #2 The new SSR entries and the Astro app are mapped, so a committed result fills the cell without code changes (with a test); the Astro caveat is a note under the table
- [ ] #3 Web vitest, e2e and the axe suite pass in light and dark
- [ ] #4 The hero H1 reads 'The best of every stack, in one framework'; the table heading reads 'Feels like React. Runs like vanilla JS.'
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11: the table heading changes from 'One framework where others need two' (it read as passive-aggressive) to 'The best of every stack, in one framework'. Keep the section's lead sentence focused on what Lumiose brings, not on what others lack.

User 2026-10-11, supersedes the heading note above: swap the two lines. The hero H1 becomes 'The best of every stack, in one framework' (the second line keeps the lit treatment, e.g. 'The best of every stack,' / 'in one framework'). The stack table's heading becomes 'Feels like React. Runs like vanilla JS.' The tagline stays in <title>, the README and package.json.
<!-- SECTION:NOTES:END -->
