---
id: decision-55
title: 'Runtime size cap, scale gate and benchmark credibility'
date: '2026-10-15 04:01'
status: accepted
---
## Context

A skeptic dismisses numbers measured by the authors on their own machine against comparison apps their agents wrote, and toy apps that say nothing about 1,500 routes. Only core, dom and islands had hard size caps; the router, actions, fetchJSON and view transitions were report-only, while M10 and M11 add code. Agreed with the user in a grilling session on 2026-10-15.

## Decision

User decision, 2026-10-15.

- **Size caps (amended by the user on 2026-10-15, TASK-321).** The first version said one 10 kB cap for the whole runtime "at about 6.5 kB today", but 6.5 kB was the typical core + dom figure: measured, a page with islands ships 9.22 kB and the whole client runtime (every export, hydrate, loader) 13.32 kB, with an SPA page about 13.1 kB. The hard caps are now **15 kB brotli for the whole client runtime** and **10 kB for core + dom + islands** (what a page with islands ships). The core + dom "every export" figure becomes report-only. Going over fails `pnpm check`; work that does not fit must find savings, or the user raises a cap. Opt-in packages (@lumiose/ui, @lumiose/query) are measured separately.
- **Large-app benchmark:** a synthetic app of about 1,500 routes and 5,000 components, measuring production build time, dev cold start, HMR latency and server memory. `pnpm release:version` runs it as an A/B of the previous release and the candidate in one run on one machine (AGENTS.md, Performance), locally rather than in CI, and stops the release on a regression above 20%. `--skip-scale-gate` (confirmed by the user on 2026-10-15) skips it for a release that must ship, such as a security fix, and the release notes record the skip.
- **Benchmark credibility:** Lumiose is submitted to the upstream js-framework-benchmark; the fullstack benchmark's raw results, methodology and implementations are published on the site; the React Router and Next.js communities are invited to review their implementations. The site's current claims stay as they are.
- Rejected: per-area caps, soft targets, absolute time thresholds, the gate in release CI, and removing claims until third parties publish numbers.

## Consequences

- Tasks: TASK-321 (cap), TASK-319 and TASK-320 (benchmark and gate), TASK-316, TASK-317 and TASK-318 (credibility).
- Outward-facing steps (the upstream pull request, community posts) need the user's approval. On 2026-10-15 the user postponed both until they decide to do them manually: the upstream submission (formerly TASK-316) and the review request (formerly TASK-318) are drafts (draft-3 and draft-4), not pending work.
