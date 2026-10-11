---
id: TASK-228
title: Islands loader chunk grows with runtime code used by any island
status: In Progress
assignee:
  - Photon
created_date: '2026-10-11 02:00'
updated_date: '2026-10-11 02:40'
labels:
  - perf
  - islands
dependencies: []
priority: medium
ordinal: 230000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-214 (Beacon, 2026-10-11). Moving the playground island into apps/web added ~1.5 kB raw (+484 B brotli) to the shared islands loader chunk (assets/loader-*.js) that every page with an island loads, because Rolldown puts the lumiose runtime exports used by any island (here the keyed selector the compiler emits for `tab() === item.id` in a .map, and a property setter) into the shared chunk. The WASM compiler, CodeMirror and the preview runtime stay on /playground. So a page's JS payload depends on the islands of the whole app, not only on its own. Decide whether island-only runtime helpers should stay in the island's chunk (chunking of the islands loader and lumiose/dom), and measure on apps/web (landing, docs) before and after.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Measured before and after on apps/web (landing, a docs page, /playground): JS bytes and requests per page
- [ ] #2 Runtime code used by only one island's graph is loaded only by that island; code shared by several islands may live in a shared chunk, without adding requests on pages that use one island
- [x] #3 The chunking rule and its trade-off are documented (compiler/vite docs or doc-1), with a test that guards it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-11 (session photon-20261011T021252Z).

Rule implemented in packages/vite/src/app/production/client-runtime.ts + runtime-chunks.ts (lumiose build, client env only; plain `vite build`, e.g. js-framework-benchmark, is untouched):
- The runtime chunk (the loader's, the SPA entry's or the shared lumiose-[hash].js) holds what the client entries import statically plus the runtime that 2+ lazy entries (islands, SPA pages) import. Runtime that exactly one lazy entry imports is left to Rolldown, which puts it in that entry's chunk (it exists anyway: no new request).
- Why not Rolldown's own `minShareCount`/`tags: ["$initial"]`: two groups with the same name make two chunks (one more request on every page); measured. So buildEnd computes the set itself (singleEntryModules) and the single `lumiose` group's test excludes it.
- Barrels: `lumiose` and `lumiose/dom` only re-export. Without help every island that imports `lumiose/dom` reaches every module it re-exports, so all runtime counts as shared. Re-export-only runtime modules are now marked `moduleSideEffects: false` in the client build (Rolldown then follows each import to the declaring module), and the analysis does the same (resolves names through `export {…} from` and `export *`, conservative fallback to the whole barrel).
- Exception, pinned in the runtime chunk: app/fetch-json.ts (FOLDED). fetchJSON reads `hasRuns` (core/effect.ts), which the minifier folds to false in apps without async components/resources and then drops the fetchJSON cache, but only within one chunk. Without the pin ssg-travel-journal's Search island (client:idle on every page) grew 1.42 -> 4.21 kB br and every page +1.48 kB br (dead cache code: cache/client 4 B -> 1673 B min).

Measurements, apps/web (lumiose build of the same tree, back to back, brotli q11; requests = module scripts + modulepreloads + their static imports):
- landing /: 5 req, 38348 B raw / 13925 B br -> 5 req, 37246 / 13528 (-1102 raw, -397 br)
- /docs/getting-started: 3 req, 34552 / 12390 -> 3 req, 33455 / 12019 (-1097, -371)
- /playground: 4 req, 531246 / 155433 -> 4 req, 531270 / 155830 (+24 raw, +397 br: selector.ts and routes/href.ts move into the 497 kB Playground chunk, where they compress worse)
- loader chunk: 30736 / 10786 -> 29634 / 10407 (-1102, -379). Playground assets were present (WASM toolchain OK).
- DocsSearch is on-demand (not preloaded); it is unchanged (fetchJSON pinned).

size:apps (framework kB br, report-only):
- ssr-bookshelf: loader 11.24 -> 10.29; ReadingListToggle 0.61 -> 1.64 (submit/actions); StarRatingInput 1.02 -> 1.21 (selector); total 10.94 -> 11.32. Pages without those islands -0.95; with ReadingListToggle +0.08; with both +0.27.
- ssg-travel-journal: loader 9.53 -> 8.40; Search 1.42 -> 2.67 (keyed list); total 9.39 -> 9.55; every page (Search is client:idle in the layout) +0.12.
- spa-chiptune: unchanged (13.67).
`pnpm --filter lumiose size` (runtime budgets): unchanged path, all caps OK (the islands soft target 2.75 kB was already OVER at 2.96). js-framework-benchmark: built with plain `vite build`, which does not use lumioseBuild/clientRuntime: no change.

Checks: packages/vite vitest 139/139 (new: 3 build tests in client-runtime.test.ts, 6 unit tests in runtime-chunks.test.ts; mutation-checked: removing the rule or the pin fails them), tsc -p packages/vite OK, oxlint OK, oxfmt OK, docs:gen + docs:check OK, e2e prod builds: ssg-travel-journal 17/17, ssr-bookshelf [build] 15/15.

Open for Lux (AC #2 not checked): the fetchJSON pin is an exception to AC #2 (fetchJSON + cache stay in the loader even when one island uses them; on apps/web that costs ~330 B br on every page vs. no pin). Options:
 A. Accept the pin as is (current state).
 B. Spark follow-up: make the fetchJSON cache reachable only from code that creates runs (createRun installs it), so no in-chunk folding is needed; then drop FOLDED. Best end state; runtime design change in Spark's area.
 C. Drop the pin and accept +1.48 kB br per page on ssg-travel-journal-like apps (not recommended).
Recommendation: A now, B as a follow-up task.
<!-- SECTION:NOTES:END -->
