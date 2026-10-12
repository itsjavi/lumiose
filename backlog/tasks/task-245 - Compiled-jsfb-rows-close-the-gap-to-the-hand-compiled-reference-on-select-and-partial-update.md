---
id: TASK-245
title: >-
  Compiled jsfb rows: close the gap to the hand-compiled reference on select and
  partial update
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-12 13:24'
labels:
  - benchmark
  - performance
  - compiler
milestone: m-8
dependencies: []
priority: medium
ordinal: 247000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The 2026-10-12 quiet-machine js-framework-benchmark run (ef81f5b) projects Lumiose at 1.132, above the doc-1 §11 target (CPU <= 1.12); lumiose-hand projects 1.09. The gap is mostly 03_update10th1k_x16 (17.4 vs 16.0 ms) and 04_select1k (6.0 vs 5.3 ms). Compare the compiler output with src/hand-compiled.js on these paths and close the gap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The codegen differences behind 03 and 04 are identified
- [ ] #2 A jsfb run (03, 04 at least) shows the compiled app within noise of lumiose-hand, or the remaining gap is explained
<!-- AC:END -->
