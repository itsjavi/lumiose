---
id: TASK-18
title: 'Implement hydration, the island loader and island records'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:12'
labels: []
milestone: m-2
dependencies:
  - TASK-47
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server-first islands need a small loader and a positional hydration protocol that never refetches awaited data (decision-9, spec §7.2, §7.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The hydrate walk claims nodes positionally, with per-async-instance ranges and replay of await records keyed by (instancePath, site, occurrence)
- [ ] #2 Loader ≤1 kB: records appended across chunks, TreeWalker discovery, load/idle/visible/media/only triggers, event capture and replay, slot templates
- [ ] #3 An end-to-end browser test: SSR page → islands hydrate → no refetch; a mismatch falls back to a client render (LUM4006 in dev)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-16), slot protocol change (server side done by Nova, client by Spark):
- Slots rendered during SSR are emitted inline only, wrapped as <!--l:s:name-->…<!--/l:s-->, and the client adopts those nodes.
- <template data-l-slot> is emitted only for slots that were not rendered during SSR.
- Text separators: adjacent dynamic texts get <!--!-->. A dynamic text next to static text gets no separator, and an empty dynamic text produces no text node. The hydrate walk must create a text node in that case.
- Agree the details with Photon's TASK-14 output.

Nova (from TASK-24): lumen dev adds <head> assets in packages/lumen/src/app/dev/plugin.ts headAssets() (Vite client + linked stylesheets); add the island loader client entry there (one line) when it exists. In dev, island module URLs are Vite import URLs: moduleUrl('/src/X.stsx') = '/src/X.stsx?import' (non-JS extensions get ?import, as import analysis writes them), so the loader should import through virtual:lumen/islands (Photon's manifest) and never build URLs from bare specifiers.

Lux: doc-2 §3.1 now holds the full hydration marker table (Nova, TASK-47). Also from Nova and Photon:
- Add the island loader to headAssets().
- Dev island URLs are /src/X.stsx?import.
- The loader imports virtual:lumen/islands; its keys equal the record refs.
- Walk template content and server nodes side by side.
- Create text nodes for empty text() holes.

Lux (from TASK-12 and TASK-49):
- Parentless branchValue/listValue ranges must adopt the server <!--[-->…<!--]--> regions under hydration.
- Size: all exports measure 9.48 kB against the 10 kB hard cap. Keep hydration and the loader tree-shakeable and as small as possible (soft target ≤ 1.5 kB). The cap applies to what an app actually ships; report the typical-app number with hydration included.
<!-- SECTION:NOTES:END -->
