---
id: TASK-111
title: 'Fullstack bench: harness, conformance suite, results JSON and HTML viewer'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 04:07'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-4 §4–§7: @bench/harness runner for every metric, the shared Playwright conformance suite (e2e/), the results JSON format and results/index.json, and the static viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm --filter @bench/harness bench [--quick|--only|--metrics] measures every metric in doc-4 §4 and writes results/<date>-<host>.json + index.json
- [ ] #2 The conformance suite covers doc-4 §5 and runs against any app by base URL
- [ ] #3 viewer/index.html shows a run (and a comparison of two runs) per metric group with tables and bar charts; served by the view script
<!-- AC:END -->
