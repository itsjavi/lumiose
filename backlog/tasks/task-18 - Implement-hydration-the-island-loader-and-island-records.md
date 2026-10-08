---
id: TASK-18
title: 'Implement hydration, the island loader and island records'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
labels: []
milestone: m-2
dependencies:
  - TASK-14
  - TASK-15
  - TASK-16
  - TASK-17
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
