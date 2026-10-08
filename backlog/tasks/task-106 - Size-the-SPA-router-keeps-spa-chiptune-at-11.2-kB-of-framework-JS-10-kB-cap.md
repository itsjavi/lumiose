---
id: TASK-106
title: 'Size: the SPA router keeps spa-chiptune at 11.2 kB of framework JS (10 kB cap)'
status: To Do
assignee:
  - Spark
created_date: '2026-10-08 22:19'
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
- [ ] #1 Lux decides the budget that applies to SPA apps (router included or separate)
- [ ] #2 spa-chiptune fits the decided budget in pnpm --filter lumen size:apps
<!-- AC:END -->
