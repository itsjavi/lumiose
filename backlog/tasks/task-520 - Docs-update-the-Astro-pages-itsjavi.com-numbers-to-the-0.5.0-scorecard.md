---
id: TASK-520
title: 'Docs: update the Astro page''s itsjavi.com numbers to the 0.5.0 scorecard'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-21 07:24'
updated_date: '2026-10-21 07:25'
labels:
  - docs
milestone: m-13
dependencies:
  - TASK-486
priority: low
ordinal: 514000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
coming-from/astro.md ("What a real port showed" and "Where Astro is ahead today") still quotes the 0.4.0 measurement of the itsjavi.com port: 182 installed packages, and pages with islands loading about 12 kB more JavaScript, "which ?client is meant to remove". doc-11 now holds the 0.5.0 scorecard (TASK-486): with ?client the pages load 1.7-2.4 kB of JavaScript against Astro's 1.3-1.7 kB inline, 175 packages, every page but the editor lighter in total, 2 to 4 more requests (TASK-519), warm builds 2.2 s against 2.3 s.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 coming-from/astro.md quotes the 0.5.0 scorecard from doc-11, dated, including what is still worse (requests, dev cold start)
- [x] #2 pnpm --filter lumiose docs:check passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
coming-from/astro.md now quotes the 0.5.0 scorecard of the itsjavi.com port (JavaScript per page 1.7-2.4 kB against Astro's 1.3-1.7 kB, type check 1.2 against 5.8 s, 175 against 433 packages, builds on par, slower dev start), and the 'where Astro is ahead' bullet speaks of requests for small scripts instead of the island runtime. llms regenerated; CLI docs tests green.
<!-- SECTION:FINAL_SUMMARY:END -->
