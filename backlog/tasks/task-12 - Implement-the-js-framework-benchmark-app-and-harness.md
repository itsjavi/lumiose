---
id: TASK-12
title: Implement the js-framework-benchmark app and harness
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:03'
labels: []
milestone: m-1
dependencies:
  - TASK-11
  - TASK-13
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The performance goal must be measured, not asserted: CPU ≤1.12, memory ≤2.7 MB, bundle ≤6 kB (spec §11).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A keyed js-framework-benchmark implementation of Lumen follows krausest's rules
- [ ] #2 A reproducible local script runs the benchmark for Lumen, vanillajs, Solid and React (plus Svelte and Vue Vapor if feasible) and writes a results table
- [ ] #3 Runtime size is measured (min+brotli) against the spec budgets; results and gaps are recorded in the task notes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: the user set the runtime size budget to a 10 kB hard cap (min+brotli, the whole client runtime). Smaller is better, but CPU wins over bytes. Soft target: ≤ 6 kB for typical imports; the js-framework-benchmark bundle ≤ 8 kB. The current 5.02 kB for the benchmark import set is within budget, so focus tuning on CPU and memory.

Lux: start now with a hand-compiled Lumen implementation (written as the compiler would emit it, per doc-2) to set up the krausest harness and get early runtime numbers for tuning. The final AC requires the compiled .stsx version once TASK-11 is Done.

Spark: claimed TASK-12 (session spark-task12-20261008T140314Z). Starting harness + hand-compiled Lumen keyed impl per Lux's note.
<!-- SECTION:NOTES:END -->
