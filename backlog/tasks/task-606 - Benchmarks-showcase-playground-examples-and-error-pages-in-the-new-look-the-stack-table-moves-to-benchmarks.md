---
id: TASK-606
title: >-
  Benchmarks, showcase, playground, examples and error pages in the new look;
  the stack table moves to /benchmarks
status: Done
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
updated_date: '2026-11-17T16:30:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 598000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restyle the remaining site pages to the redesign: /benchmarks, /showcase, /playground, /examples, /stsx, the errors pages and not-found. The stack comparison table moves from the landing to /benchmarks (user, 2026-11-17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 /benchmarks shows the stack table, still fed by the committed results through the content modules
- [x] #2 Charts are monochrome, with amber only for the Lumiose series
- [x] #3 Each page is shorter or equal in length: no new copy blocks
- [x] #4 Unit and e2e suites of apps/web pass, a11y suite included
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-602 (Lux): src/playground/samples.ts hard-codes old brand colours. The local build of the web app fails at the playground wasm step when the wasm-bindgen CLI version differs from the pinned one; lumiose build runs without it.

Beacon (beacon-20261117-t606): restyled /benchmarks (with its two sub-pages), /showcase, the playground's editor theme and samples, not-found, BarChart, Showcase/PageHead and ThemePalette to decision-90. New apps/web/src/components/StackTable.stsx (props: rows: readonly StackRow[] from stacks(); labelledBy: id of the naming heading) renders the stack table on /benchmarks (#stacks) with tableNote and ASTRO_NOTE; the landing keeps its own copy until TASK-607 drops it. Charts: grey bars, amber for Lumiose, whose row is also bold. /showcase lists the rendering modes as numbered rows instead of cards. No copy added; the only addition to /benchmarks is the moved table with its two existing notes. /examples and /errors are redirects, and /stsx is drawn by DocsShell and DocArticle (TASK-608), so they needed no change here. Left as is: the red of errors in the playground (a status colour, not a brand colour): a decision for the review (TASK-615). Commits 637c1a87, beb97a3c. Screenshots: backlog/assets/redesign/task-606-{benchmarks,showcase}-{dark,light}.jpg.
Checks: lumiose check clean; vitest 53 passed; pnpm typecheck and pnpm lint pass; e2e web (20 passed, with the new /benchmarks test), playground (7 passed) and showcase.dev (4 passed). The static suites ran against lumiose build served by e2e/serve.ts, because the playground wasm step fails locally (wasm-bindgen CLI version differs from the pinned one). AC #4 is open: the a11y suite ran 146 passed, 3 failed, on a tree with other tasks in flight, and none of the failures is in this task's styles: (1) 'axe: text keeps AA contrast over decorative layers (light)': the spec's own flattening stylesheet still paints .btn.primary amber and the header grey (old identity; a11y.e2e.ts lines edited by TASK-605); (2) 'text over the beams': the landing's '0 kB' (TASK-605/607); (3) reflow at 320 px on /ui (TASK-614). A re-run after those tasks committed was not possible: the e2e lock was held. Next action: re-run e2e/a11y.e2e.ts once TASK-605, 607 and 614 land, then check AC #4 and set Done.

Beacon (beacon-20261117-verify): AC4 verified on the static build served by e2e/serve.ts, after TASK-605 and TASK-614 landed. a11y.e2e.ts 149 passed, 0 failed; web 13 passed, 2 skipped (screenshot captures); docs 4 passed; ui 11 passed, 1 skipped; redirects 19 passed; playground 7 passed, 1 skipped; showcase.dev 4 passed (lumiose dev). The three earlier failures: the flattened-layers test is fixed in d95a610c (the header's opacity and the stale .btn.primary rule, see TASK-605); the landing's '0 kB' over the beams and the 320 px reflow on /ui pass on the current build.
Unit: lumiose check clean, pnpm typecheck and pnpm lint pass, vitest 52 passed and 1 failed: 'docs links only to pages and anchors that exist' reports deploy/coolify → /docs/deploy/docker#the-dockerfile. That is another worker's uncommitted rewrite of packages/lumiose/docs/deploy/docker.md (TASK-611), which renames the heading; the committed docs have it, and nothing in this task's files is involved.
Not verified: the playground wasm build (the wasm-bindgen CLI is 0.2.129, the workspace pins 0.2.130): the playground suite ran against the wasm built earlier.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
/benchmarks (with the stack table moved from the landing), /showcase, the playground theme, not-found and the charts follow decision-90: black and white, grey bars, amber only for Lumiose. No copy was added. The e2e suites of apps/web pass on the static build, the a11y suite included (149 passed).
<!-- SECTION:FINAL_SUMMARY:END -->
