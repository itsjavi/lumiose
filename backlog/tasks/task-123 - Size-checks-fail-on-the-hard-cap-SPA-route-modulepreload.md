---
id: TASK-123
title: 'Size checks: fail on the hard cap; SPA route modulepreload'
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 04:20'
labels:
  - size
  - perf
dependencies: []
priority: low
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 findings 12 and 13. size prints OVER for soft targets but exits 0 even for the hard cap; typical core+dom is 6.03 kB vs the 6.00 soft target; islands 2.63 vs 1.50 soft. SPA deep links pay an extra round trip because the shell does not modulepreload the matched route/layout chunks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm --filter lumen size exits non-zero when the 10 kB hard cap is exceeded and is part of pnpm check; soft targets are reported only; doc-1 §6 soft targets reviewed against reality (proposal to Lux if they should change)
- [ ] #2 SPA shells modulepreload their matched route and layout chunks; measured before/after
<!-- AC:END -->
