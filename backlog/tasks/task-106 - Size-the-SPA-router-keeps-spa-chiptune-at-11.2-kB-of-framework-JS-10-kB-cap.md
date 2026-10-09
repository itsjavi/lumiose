---
id: TASK-106
title: 'Size: sample apps have no budget; size:apps reports, router trims where cheap'
status: Done
assignee:
  - Spark
created_date: '2026-10-08 22:19'
updated_date: '2026-10-09 04:11'
labels:
  - size
  - runtime
  - router
dependencies: []
priority: medium
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-91. After the single runtime chunk, the CSR start without hydration and the smaller preload helper, pnpm --filter lumen size:apps reports spa-chiptune at 11.18 kB brotli of framework JS: runtime 7.30 (core, DOM, lists, Vite helper; no hydration) + router 3.69 (router.ts ~2.9, route matching ~0.4, Link, href, csr start) + app helpers 0.19. The islands apps fit: ssr-bookshelf 9.82, ssg-travel-journal 9.03. Spec §6 lists the hard cap's scope as core, DOM, lists, boundaries, hydration and loader (the router is not named); Lux's TASK-91 note applies the cap to what an app ships. Options: (a) Lux decides the router's budget (separate router budget, or the cap counts the runtime only); (b) slim the router: load the History API fallback lazily only when the Navigation API is missing (measured about -0.35 to -0.5 kB), compact the client route table/matcher, BuiltinError and csr start; even all of these leave about 10.5 kB.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pnpm --filter lumen size:apps reports per-app sizes and exits 0 (no per-app budget); the runtime cap stays enforced by pnpm --filter lumen size
- [x] #2 Router trims that cost no runtime speed or complexity are applied (e.g. History fallback loaded only without the Navigation API) with before/after numbers in the notes; docs and spec mention of size:apps match
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: user decision: examples get no size budget ('they are just examples, try to be optimal and that's it'). Spec doc-1 §6 now says the cap applies to the framework runtime measured by size; size:apps is a report. Do only trims that are clearly worth it.

Spark 2026-10-09: size:apps is now a report (no cap, exits 0); size keeps the runtime cap. Router trim: the History API fallback moved to app/router/history.ts, loaded with import() only when the Navigation API is missing (listen() and navigate() wait for it there); client-runtime keeps it out of the runtime chunk. spa-chiptune before/after (size:apps): framework 11.28 -> 10.86 kB brotli (router 3.78 -> 3.35 kB; spa chunk 12.19 -> 11.79 kB); the fallback chunk is 0.71 kB, reported apart. ssr-bookshelf 9.85 and ssg-travel-journal 9.03 unchanged. No other trims: the remaining options (compact route table/matcher, BuiltinError, csr start) save little and add complexity. Added a Playwright test that deletes window.navigation and routes through the fallback (dev+preview). Validation: typecheck, lint, router/dom tests (169), client-runtime tests, size, size:apps (exit 0), docs:check, spa-chiptune Playwright 18/18. Unrelated failures in full lumen vitest from concurrent work: docs.test LUM1008 stale error page (lumen_content changes in the tree), cli.test timeout under load.
<!-- SECTION:NOTES:END -->
