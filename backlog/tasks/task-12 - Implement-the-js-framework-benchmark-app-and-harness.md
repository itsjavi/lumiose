---
id: TASK-12
title: Implement the js-framework-benchmark app and harness
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-11
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
