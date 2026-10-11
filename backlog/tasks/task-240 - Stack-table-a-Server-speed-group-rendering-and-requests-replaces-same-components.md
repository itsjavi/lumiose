---
id: TASK-240
title: >-
  Stack table: a Server speed group (rendering and requests) replaces 'same
  components'
status: Done
assignee:
  - Beacon
created_date: '2026-10-11 03:48'
updated_date: '2026-10-11 04:10'
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
- [x] #1 The table shows a 'Server speed' group with 'Rendering' (renders/s) and 'Requests' (req/s) sub-columns, filled from committed results, with 'measuring' where a result is pending
- [x] #2 The new SSR entries and the Astro app are mapped, so a committed result fills the cell without code changes (with a test); the Astro caveat is a note under the table
- [x] #3 Web vitest, e2e and the axe suite pass in light and dark
- [x] #4 The hero H1 reads 'The best of every stack, in one framework'; the table heading reads 'Feels like React. Runs like vanilla JS.'
- [x] #5 The eyebrow reads 'Static sites · Server-side rendering · Islands · SPAs'; the meta/OG description leads with those terms and is at most 160 characters (with a test)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User 2026-10-11: the table heading changes from 'One framework where others need two' (it read as passive-aggressive) to 'The best of every stack, in one framework'. Keep the section's lead sentence focused on what Lumiose brings, not on what others lack.

User 2026-10-11, supersedes the heading note above: swap the two lines. The hero H1 becomes 'The best of every stack, in one framework' (the second line keeps the lit treatment, e.g. 'The best of every stack,' / 'in one framework'). The stack table's heading becomes 'Feels like React. Runs like vanilla JS.' The tagline stays in <title>, the README and package.json.

User 2026-10-11: (1) the hero eyebrow becomes 'Static sites · Server-side rendering · Islands · SPAs': full search terms, no acronyms; the H1 already says 'in one framework'. (2) The site's meta and OG description lead with those terms and stay under 160 characters, for example: 'Lumiose: one web framework for static sites, server-side rendering, islands and SPAs. TSX with scoped CSS, signals, and 0 kB of JS until a page needs it.' The visible descriptor in the hero, README and docs stays as decided.

User 2026-10-11, after seeing it: no sub-columns. 'Server speed' is one column, and each cell stacks the two metrics on two lines (renders/s over req/s). This supersedes the group-header layout.

User 2026-10-11, correction: keep two columns. Only the sub-header titles go. A single 'Server speed' header cell spans both columns (colspan 2), with no 'Rendering'/'Requests' row; each cell carries its unit (renders/s, req/s). This supersedes the stacked-cell note above.

User 2026-10-11: React Router is full stack (framework mode; Remix merged into it), so its 'Full-stack layer' cell is 'Built in', not 'Separate project'.

Beacon: done. Layout (per Lux's corrections, user 2026-10-11): one header row; 'Server speed' is a single th with colspan=2 over two self-describing cells ('664 renders/s', '1,248 req/s'); no Rendering/Requests sub-header row (a stacked single-column variant was tried and reverted). Data: evidence.ts adds rendersByFramework (SSR RESULTS.md rows by Framework name, variants with '(' excluded) and requestsByApp/requestsRun (server.home.rps from the newest full fullstack run that measured it; payloads keep their own newest run). stacks.ts maps rendering by SSR name (React for both React rows; 'Preact', 'Astro', 'Remix 3' pending TASK-241, names must match exactly) and requests by app id ('astro' pending TASK-242; Preact is the fact 'No full-stack layer'); a vitest proves committed values fill them. Astro's serverJs stays the fact '0 kB'. React Router's full-stack layer is 'Built in' (framework mode). Astro caveat is a note under the table; the note cites both server runs. Hero H1 'The best of every stack,' / lit 'in one framework'; table heading is the tagline; eyebrow 'Static sites · Server-side rendering · Islands · SPAs'; meta/OG description 153 chars, search terms first (vitest + e2e length checks); <title> keeps the tagline. Checks: web vitest 24 passed, lumiose check clean, oxlint clean, oxfmt, web e2e 64 passed / 3 skipped (axe light+dark, hero no-flash/contrast at 390 px). Evidence: backlog/assets/task-240-stack-table.png, backlog/assets/task-240-hero-390.png.
<!-- SECTION:NOTES:END -->
