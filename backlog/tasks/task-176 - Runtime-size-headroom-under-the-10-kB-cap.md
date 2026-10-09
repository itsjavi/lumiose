---
id: TASK-176
title: Runtime size headroom under the 10 kB cap
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 12:33'
labels:
  - size
  - perf
milestone: m-7
dependencies: []
priority: low
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-168 the every-export runtime is 9.97 kB brotli against the 10 kB hard cap (doc-1 §6), so the next runtime feature needs a trim first. Regain headroom without CPU regressions: dead/duplicated helpers, dev-only code reaching production builds, shorter internal names that survive minification, shared paths between list/branch/insert.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every-export ≤ 9.6 kB brotli with no jsfb CPU regressions (01–09 within noise, short run); typical imports and islands no larger
<!-- AC:END -->
