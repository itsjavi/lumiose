---
id: TASK-233
title: fetchJSON cache reachable only from code that creates runs
status: To Do
assignee:
  - Spark
created_date: '2026-10-11 02:41'
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
