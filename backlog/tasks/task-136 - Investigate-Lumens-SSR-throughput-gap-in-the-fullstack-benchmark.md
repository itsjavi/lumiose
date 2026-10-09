---
id: TASK-136
title: Confirm fullstack req/s ranking; investigate Lumen's project-page LCP
status: Done
assignee:
  - Prism
created_date: '2026-10-09 04:45'
updated_date: '2026-10-09 05:35'
labels:
  - perf
  - server
  - benchmark
milestone: m-8
dependencies: []
priority: high
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User report 2026-10-09: in the fullstack comparison Lumen wins every metric except server req/s, where it is ~2.6x or more slower than React Router and Next.js. The committed quick run (7e59b48, lumen only, before Quasar's data-layer speedups in 029ff73) shows /api/issues/:id at 8,652 req/s but pages at 78 (/), 166 (/projects) and 222 (/issues) req/s with p99 up to 2.6 s, so the page pipeline, not request handling, is slow. Find out whether the cause is the framework (adapter-node Node<->Web conversion, streaming, request scope, ssr() promises, dev checks in production, per-request work) or the benchmark app (repeated data calls, serial awaits, missing caching that the React apps have), and what to change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Re-measured on the current tree for all three apps with per-route req/s and a per-request CPU breakdown (CPU profiles) for Lumen vs at least one React app
- [x] #2 Root causes ranked by impact with evidence; each classified as framework vs benchmark-app vs harness
- [x] #3 Concrete fixes proposed with expected gains (prototype numbers where possible); Lux files the follow-up tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: the reported 2.6x req/s gap came from a fake viewer fixture (zz-fake.json, Nova, deleted). The real quick run (results/2026-10-09T045317-macbookpro.json) has Lumen ahead on every route. Refocused: confirm with full server runs; investigate Lumen's worse LCP on /projects/:slug (190–210 ms vs 130–145 ms).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Prism: full interleaved runs confirm Lumen leads req/s on every page route (/ 1.9x RR, 3.1x Next; /issues 3.0x/8.8x; p99 2x lower than RR); API route level. Lumen's render pipeline ~0.31 ms/request vs RR ~0.98 ms. NODE_ENV has no effect. Project-page LCP loss: hydration detaches/re-inserts server-rendered slot and block nodes, so Chrome re-reports LCP (TASK-152). Server wins: server prop getters re-evaluated per read (16x labels query per request) -> decision-28/TASK-151; adapter-node static stat() per request, per-request import(), documentRules scan, Node<->Web conversion -> TASK-150. Scratch and prototypes.patch in .local/agents/Prism/task136-1791521148/.
<!-- SECTION:FINAL_SUMMARY:END -->
