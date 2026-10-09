---
id: TASK-123
title: 'Size checks: fail on the hard cap; SPA route modulepreload'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:31'
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
- [x] #1 pnpm --filter lumen size exits non-zero when the 10 kB hard cap is exceeded and is part of pnpm check; soft targets are reported only; doc-1 §6 soft targets reviewed against reality (proposal to Lux if they should change)
- [x] #2 SPA shells modulepreload their matched route and layout chunks; measured before/after
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: scripts/size.ts labels budgets as hard cap / soft target and exits 1 when a hard cap (10 kB: core+dom every export 9.77 kB, typical+islands 8.66 kB) is exceeded; verified with a temporary 9 kB cap (exit 1). Root pnpm check runs pnpm --filter lumen size. New reported line: whole client runtime (every export + hydrate + loader) = 12.35 kB brotli, which is over 10 kB if doc-1 §6's hard-cap wording (core, DOM, lists, boundaries, hydration and loader) is read literally; no page ships all of it, so it is reported but not gated (proposal to Lux). Soft targets today: typical 6.03/6.00 kB, islands on top 2.63/1.50 kB (hydrate 1.85, loader 0.78). SPA modulepreload: the build records per SPA layout/page its chunk + static-import closure (minus the SPA entry) as spaPreloads in the server entry; SPA pages emit <link rel=modulepreload> for their layouts and page. Measured on spa-chiptune (dist, 100 ms CDP latency, cache off, median of 5, time to route content): over HTTP/2 /instruments 266 -> 191 ms, /songs 269 -> 197 ms, /settings 251 -> 185 ms; over lumen preview's HTTP/1.1 no change (~490/390/380 ms both ways: the 6-connection limit, not discovery, is the bottleneck there). Tests: client-runtime.test.ts (SPA page preloads layout+page, MPA page none), handler.test.ts; spa-chiptune 18/18 and spa-router-e2e 22/22 Playwright. Docs: rendering-modes.md.
<!-- SECTION:NOTES:END -->
