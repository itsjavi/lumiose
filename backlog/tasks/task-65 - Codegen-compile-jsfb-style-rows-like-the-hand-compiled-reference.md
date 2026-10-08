---
id: TASK-65
title: 'Codegen: compile jsfb-style rows like the hand-compiled reference'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:10'
updated_date: '2026-10-08 16:12'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The compiled js-framework-benchmark app (benchmarks/js-framework-benchmark, krausest `lumen`) uses 0.37 MB more run memory than the hand-compiled reference (`lumen-hand`, src/hand-compiled.js) and misses the spec memory target (2.87 vs ≤ 2.7 MB). Found by Spark in TASK-12; RESULTS.md has the numbers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In .map() callbacks, consts initialised from row data without calls (const id = row.id) count as row data: selector hoisting and data-slot event hoisting apply (doc-2 §5.2)
- [ ] #2 Plain-value text children ({id}) compile to a one-time write into a template text placeholder (doc-2 §5.4) instead of a static insert
- [ ] #3 Dynamic text children ({row.label()}) avoid a region and a created text node per row (template placeholder plus a text binding; Spark adds a runtime helper with an insert fallback for non-text values if the contract needs one)
- [ ] #4 pnpm bench:jsfb: lumen run memory ≤ 2.7 MB and CPU within 2 % of lumen-hand
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: reviewed and assigned to Photon. The compiled js-framework-benchmark run uses 2.87 MB vs 2.50 MB hand-compiled, against a 2.7 MB target. Do this after TASK-45/52, before TASK-50.
<!-- SECTION:NOTES:END -->
