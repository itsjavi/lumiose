---
id: TASK-228
title: Islands loader chunk grows with runtime code used by any island
status: To Do
assignee: []
created_date: '2026-10-11 02:00'
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
