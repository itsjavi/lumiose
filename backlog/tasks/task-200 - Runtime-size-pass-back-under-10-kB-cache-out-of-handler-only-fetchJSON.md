---
id: TASK-200
title: 'Runtime size pass: back under 10 kB, cache out of handler-only fetchJSON'
status: In Progress
assignee:
  - Spark
created_date: '2026-10-10 20:12'
updated_date: '2026-10-10 20:13'
labels:
  - size
  - core
dependencies: []
priority: medium
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-1 §6 (user 2026-10-10): optimize for ≤10 kB every-export; raise HARD_CAP only if impossible, never above 12 kB. After TASK-196/193 the every-export measure is 10,321 B (cap 10,240). Find CPU-neutral savings across core/dom (dead code, duplicated helpers, DEV-only strings, shorter internals). Also, from TASK-195: an app that imports fetchJSON pays +1,054 B for the cache even if it only calls it in handlers; split so the cache code is only pulled in where component-level awaits need it, if that can be done without a new public API. Never trade runtime CPU for bytes (benchmarks must not regress).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 every-export ≤ 10,240 B brotli, or HARD_CAP raised to the smallest needed value ≤ 12 kB with doc-1 §6 and the reasons recorded
- [ ] #2 fetchJSON-in-handlers apps don't pay for the cache (or the reason it can't be split is recorded); js-framework-benchmark shows no CPU regression
<!-- AC:END -->
