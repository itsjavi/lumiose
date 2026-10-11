---
id: TASK-233
title: fetchJSON cache reachable only from code that creates runs
status: To Do
assignee:
  - Spark
created_date: '2026-10-11 02:41'
updated_date: '2026-10-11 02:49'
labels:
  - perf
  - core
milestone: m-7
dependencies: []
priority: medium
ordinal: 235000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up to TASK-228 (Photon). The islands chunking rule keeps runtime that one island imports in that island's chunk. app/fetch-json.ts is the one exception, pinned in the shared runtime chunk. fetchJSON reads hasRuns (core/effect.ts), and the minifier folds it to false and drops the cache only when both sit in the same chunk. Without the pin, ssg-travel-journal would ship 1.48 kB brotli of dead cache code on every page. The pin costs about 330 B brotli per page on apps/web. Lux's decision (2026-10-11): keep the pin for now (option A), then restructure the runtime so the cache is only reachable from code that creates runs (for example, createRun installs it), so no folding is needed (option B). Then remove the pin. Lux authorizes edits to packages/vite/src/app/production/runtime-chunks.ts (Photon's TASK-228 code) to remove it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The fetchJSON cache is only pulled in by code that creates runs; apps without async components or resources ship no cache code, whatever the chunking
- [ ] #2 The fetch-json pin is removed from the islands chunking rule; ssg-travel-journal, ssr-bookshelf and apps/web sizes are measured before and after, and none regresses
- [ ] #3 TASK-200's size budgets and js-framework-benchmark CPU numbers do not regress
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): blocked on a decision, nothing changed in the source. The ACs ask for two things that cannot both hold without folding. (a) Zero waste needs a conjunction: the cache is only live when fetchJSON AND a run creator are both in the bundle. A static ESM graph can only express unions, since a module is included when anything included references it, so the only way to express the AND is to fold a flag (today's hasRuns). Folding needs the flag and the guarded reference in one chunk, whatever the chunking. (b) Option B as stated (the run creators reach the cache) is a union with runs. The run creators are dom/async.ts ($async) and core/async.ts (resource()). Importing the cache from either puts it (about 1.4-1.5 kB brotli: Photon's 1.48 kB) into "core + dom (every export)". That bundle is 9.91 kB today against a 10 kB hard cap, so it would reach about 11.4 kB. B also gives the cache to every app with async components or resources that does not fetch, and breaks "nothing in core or dom knows about the cache". Keeping core/dom clean would mean reaching the cache only from public entries: a compiler-emitted import for $async (Photon, Rust) and an app-layer resource() wrapper in `lumiose`, with an export * name clash to resolve. Runs-only apps still pay about 1.4 kB. Options for Lux: (B) as above, accepting those costs and the compiler change. (C) Keep folding but pin only a tiny gate: move the hasRuns check and the cached() call out of fetch-json.ts into app/cache/run-fetch.ts, and pin that module instead of fetch-json.ts. fetch-json then follows its island, the pinned code folds to about 20-40 B when there are no runs, and apps/web's loader chunk drops about 300 B. A pin remains. (D) Build-time knowledge: the plugin defines whether runs exist (no async component or resource import in the graph) as a constant. That is robust to any chunking, but Vite builds in one pass, so it needs a late renderChunk rewrite or a pre-scan. Recommendation: C (small, safe, measurable), or D if the pin must go. Baselines measured (size-apps, framework brotli across all chunks): ssr-bookshelf 11.31 kB, ssg-travel-journal 9.61 kB, apps/web 9.95 kB; size.ts every export 9.91 kB, typical + islands 8.97 kB. Moving fetch-json between chunks changes per-chunk numbers, not these totals. Raw output is in .local/agents/spark/t233/. Claim released.
<!-- SECTION:NOTES:END -->
