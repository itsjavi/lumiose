---
id: TASK-288
title: Profile build time on the itsjavi.com port against Astro
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-17 00:52'
labels:
  - build
  - performance
dependencies: []
priority: low
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 11. Same pages and images: lumiose build takes 5.9 s cold and 3.4 s warm (median of 3) against Astro's 4.2 s and 2.3 s. Find where the time goes (client build, server build, prerender, stylesheet merging, precompression) and fix what is Lumiose's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A profile of the port's build is recorded in the task, with the share of each step
- [x] #2 Lumiose-side costs found are fixed or recorded as follow-up tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17 (Lux, orchestrator): assigned to Nova for the next unattended batch. Nova measured the port in TASK-285.

Nova (2026-10-17): claimed, branch claude/nova-css-0fc0df.

Nova (2026-10-17), profile and fix (commit 4fac89e7).

Method: copies of the port (lumiose 0.4.0 from npm) and of the Astro site in a scratch directory; a third copy links lumiose, @lumiose/vite and @lumiose/cli to this branch. Each step timed from the build's log lines (wall clock), median of 3 warm runs; a CPU profile (node --cpu-prof) for what runs on the main thread. M1 Max, 10 cores, with other agents loading the machine (cold runs vary 5-20 s, so only warm medians are compared).

Steps of the port's build, lumiose 0.4.0 (median 4.6 s):
| Step | ms | Share |
| --- | --- | --- |
| startup (CLI, Vite config, typegen) | 326 | 7% |
| client build | 398 | 9% |
| server build (style merging included) | 315 | 7% |
| prerender (52 files; includes the port's own GitHub API calls) | 497 | 11% |
| precompress (72 files, brotli 11 + gzip 9) | 2553 | 56% |

- Precompression was Lumiose's cost: one file after another after prerendering, brotli 11 alone 2.7 s of CPU, 1.3 s of it for the 564 kB code-editor chunk. Quality 10 would be 2.5x faster for 2.4% more bytes, quality 9 33x faster for 9% more: kept 11.
- The CPU profile shows the main thread idle 2.5 of 3.8 s sampled (Rolldown and zlib run on other threads); Lumiose's own JS is about 170 ms (@lumiose/vite style compilation ~100 ms, the route scan ~30 ms). Nothing else to fix there.
- Stylesheet merging (TASK-285) is inside the server build's renderChunk and does not show.

Fix: precompress.ts compresses four files at a time (libuv's thread pool size; more only queues), largest first, and startPrecompress() starts the client build's hashed files (immutable) right after the client build, during the server build and prerendering. finish() compresses new files and any file changed since (size or mtime), and removes a copy it wrote that a changed file no longer beats. Same output: 130 identical .br/.gz copies. Test: early pass, a page written meanwhile, two early files changed after compression (recompressed; stale copies of one that no longer compresses removed), each file counted once.

A/B on the port (alternating whole builds of the linked copy, main's sequential precompression behind a temporary local switch, 5 each): total 3.05 s -> 1.82 s, the wait for precompression after prerendering 1.75 s -> 0.66 s.

Against Astro (alternating, warm, 5 each): Astro 2.03 s, lumiose 0.4.0 3.24 s, this branch 1.95 s. Per step, this branch (median of 3): startup 417 ms (TS sources from the workspace; the published dist starts faster), client 365, server 327, prerender 313, the rest of precompression 458.

Follow-ups: none new. TASK-286 (a precompress: false option, or a GitHub Pages adapter) would remove the remaining precompression for hosts that ignore the copies, such as the port's.

Validation (Nova, 2026-10-17): pnpm check exit 0 (2549 tests); pnpm pack:check --smoke --skip-npm exit 0; Playwright: apps/web 179 passed, ssg-spa-e2e 19, ssg-travel-journal 17, ssr-auth 6, ssr-bookshelf 17, ssr-i18n-i18next 5, ssr-i18n-paraglide 5, ssr-realtime 9, ssr-styles-e2e 10.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Profile recorded: precompression was 56% of the port's build with 0.4.0 (brotli 11, one file at a time). It now runs four at a time, largest first, starting with the client build's hashed files during the server build and prerendering; same bytes. Port A/B 3.05 s -> 1.82 s; warm builds 1.95 s against Astro's 2.03 s (0.4.0: 3.24 s). No other Lumiose-side cost found; TASK-286 covers skipping precompression. Commit 4fac89e7.
<!-- SECTION:FINAL_SUMMARY:END -->
