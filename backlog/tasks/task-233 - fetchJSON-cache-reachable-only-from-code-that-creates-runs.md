---
id: TASK-233
title: fetchJSON cache reachable only from code that creates runs
status: Done
assignee:
  - Spark
created_date: '2026-10-11 02:41'
updated_date: '2026-10-11 02:58'
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
- [x] #1 Apps without async components or resources ship no fetchJSON cache code; only a small gate module (about 40 B or less) stays pinned in the shared runtime chunk
- [x] #2 fetchJSON follows the islands chunking rule; ssg-travel-journal, ssr-bookshelf and apps/web sizes measured before and after, none regressing
- [x] #3 TASK-200's size budgets and js-framework-benchmark CPU do not regress
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark (2026-10-11): blocked on a decision, nothing changed in the source. The ACs ask for two things that cannot both hold without folding. (a) Zero waste needs a conjunction: the cache is only live when fetchJSON AND a run creator are both in the bundle. A static ESM graph can only express unions, since a module is included when anything included references it, so the only way to express the AND is to fold a flag (today's hasRuns). Folding needs the flag and the guarded reference in one chunk, whatever the chunking. (b) Option B as stated (the run creators reach the cache) is a union with runs. The run creators are dom/async.ts ($async) and core/async.ts (resource()). Importing the cache from either puts it (about 1.4-1.5 kB brotli: Photon's 1.48 kB) into "core + dom (every export)". That bundle is 9.91 kB today against a 10 kB hard cap, so it would reach about 11.4 kB. B also gives the cache to every app with async components or resources that does not fetch, and breaks "nothing in core or dom knows about the cache". Keeping core/dom clean would mean reaching the cache only from public entries: a compiler-emitted import for $async (Photon, Rust) and an app-layer resource() wrapper in `lumiose`, with an export * name clash to resolve. Runs-only apps still pay about 1.4 kB. Options for Lux: (B) as above, accepting those costs and the compiler change. (C) Keep folding but pin only a tiny gate: move the hasRuns check and the cached() call out of fetch-json.ts into app/cache/run-fetch.ts, and pin that module instead of fetch-json.ts. fetch-json then follows its island, the pinned code folds to about 20-40 B when there are no runs, and apps/web's loader chunk drops about 300 B. A pin remains. (D) Build-time knowledge: the plugin defines whether runs exist (no async component or resource import in the graph) as a constant. That is robust to any chunking, but Vite builds in one pass, so it needs a late renderChunk rewrite or a pre-scan. Recommendation: C (small, safe, measurable), or D if the pin must go. Baselines measured (size-apps, framework brotli across all chunks): ssr-bookshelf 11.31 kB, ssg-travel-journal 9.61 kB, apps/web 9.95 kB; size.ts every export 9.91 kB, typical + islands 8.97 kB. Moving fetch-json between chunks changes per-chunk numbers, not these totals. Raw output is in .local/agents/spark/t233/. Claim released.

Lux decision (2026-10-11): option C. Move the hasRuns check and the cached call into a tiny gate module and pin only that gate (about 20–40 B) in the shared runtime chunk. fetchJSON itself then follows the islands chunking rule. Option B would push core + dom over the 10 kB hard cap and ship the cache to apps that don't fetch. Option D (a build-time constant) is more complex than the remaining waste is worth. AC #2 now reads: the pin covers only the gate module.

Spark (2026-10-11): option C implemented in 3edb233. New gate app/cache/run-fetch.ts (runFetch: the hasRuns + inRun check, the run signal and the cached() call); fetchJSON calls it with plain values and falls back to a plain request. isCacheable moved to app/cache/shared.ts (the server fetchJSON imports it from there, so the server graph does not pull the client cache). client-runtime.ts FOLDED now pins only app/cache/run-fetch.ts; client-runtime.test.ts checks fetchJSON lands in its island chunk and the cache stays out of it. Docs: concepts/islands.md (+ llms-full.txt). Verified the folded output on ssr-bookshelf: fetchJSON compiles to a plain request with no cache, isCacheable or gate code left in the caller; when the gate sits in another chunk than fetchJSON, it remains an exported empty function (the about 20-30 B pin). A variant that passed a module-level send function instead of a closure measured worse overall and was dropped.

Measurements (brotli, size-apps; before re-measured with HEAD sources on the same working tree, since concurrent dom/hydration edits moved numbers slightly):

| app | chunk | before | after |
|---|---|---|---|
| ssg-travel-journal | loader (every page) | 8.46 | 7.93 |
| ssg-travel-journal | Search island | 2.67 | 3.22 |
| ssg-travel-journal | page with Search (loader+Search) | 11.13 | 11.15 |
| ssg-travel-journal | framework total | 9.61 | 9.65 |
| apps/web | loader (every page) | 10.19 | 9.65 |
| apps/web | DocsSearch island | 1.57 | 2.12 |
| apps/web | page with DocsSearch | 11.76 | 11.77 |
| apps/web | framework total | 9.99 | 10.01 |
| ssr-bookshelf | loader (fetchJSON shared by several islands) | 10.29 | 10.32 |
| ssr-bookshelf | framework total | 11.31 | 11.35 |

Pages without the fetching island load about 0.5 kB less; pages with it pay 10-20 B; apps where several islands fetch pay the gate, about 30 B. size.ts unchanged for the capped bundles (typical + islands 8.97 kB, every export 9.94 kB, both under the 10 kB cap; core/dom untouched); the report-only fetchJSON rows moved by +0.01 kB. js-framework-benchmark: its bundle (main.js 18.14 kB) contains no fetch code, so none of the changed modules reach it and CPU cannot change; no timed run. Checks: vitest packages/lumiose + packages/vite 937/937, typecheck lumiose and @lumiose/vite, lint (no new warnings), docs:check. apps/web typecheck fails in Beacon's in-progress e2e/playground.e2e.ts, unrelated. Raw output in .local/agents/spark/t233/.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
fetchJSON now follows the islands chunking rule. Only a tiny gate module (app/cache/run-fetch.ts: the hasRuns check and the cached call) is pinned in the runtime chunk, so the minifier still drops the cache in apps without async components or resources. Every page without a fetching island loads about 0.5 kB brotli less on ssg-travel-journal and apps/web; pages with it and apps with shared fetchJSON pay 10-30 B. TASK-200 caps are unchanged, and the js-framework-benchmark bundle does not include any of the changed code. Commit 3edb233.
<!-- SECTION:FINAL_SUMMARY:END -->
