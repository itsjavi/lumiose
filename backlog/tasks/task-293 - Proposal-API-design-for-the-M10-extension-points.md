---
id: TASK-293
title: 'Proposal: API design for the M10 extension points'
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-15 02:21'
updated_date: '2026-10-15 03:16'
labels:
  - proposal
  - needs-decision
milestone: m-10
dependencies: []
documentation:
  - doc-8
priority: high
ordinal: 295000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A comparison of Lumiose with React Router's framework mode (2026-10-15) found extension points Lumiose lacks. The user agreed to plan six of them in M10: folder-scoped middleware with `ctx.route`, a client entry hook, router lifecycle hooks, per-instance form submissions, instrumentation (server and client), and a dev handler for custom servers. Each adds public API, so per AGENTS.md its shape needs the user's explicit approval before it is recorded as a decision or implemented.

Design them together so names and semantics stay consistent: file names (such as `src/client.ts` and a folder `middleware.ts`), hook names (React, Solid and TanStack vocabulary, decision-32 and decision-35), what `ctx` carries, which phases instrumentation wraps, and where client hooks register (the client entry hook).

For each feature: the problem with a concrete example, one recommended shape and the alternatives considered, prior art (React Router 7 middleware, client loaders and actions, instrumentations, useBlocker and useFetcher; SvelteKit hooks, beforeNavigate/afterNavigate and instrumentation.server; Next.js middleware and instrumentation.ts with onRequestError; Astro middleware; SolidStart), how it behaves in each rendering mode (static, server, spa, prerendered) and with islands and zero-JS pages, and its runtime byte cost.

Out of scope: route loaders and RPC server functions (decision-18), routes defined in code (decision-42).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A proposal covers the six features, each with a recommended shape, alternatives, prior art, rendering-mode behaviour and byte cost
- [x] #2 The user's approval or requested changes are recorded per feature in this task
- [x] #3 Approved shapes are recorded as decisions, and M10's implementation tasks are updated with them
- [x] #4 Rejected or deferred features are recorded with the reason, and their tasks updated or closed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Proposal drafted for the user review in doc-8 (2026-10-15), grounded in the current server, router, actions and dev-server code and in React Router, Next.js, SvelteKit, Solid Router and TanStack prior art. Waiting for the user approval per feature (AC #2). Found while researching: TASK-305 (island load or hydration failures are unhandled).

User review 2026-10-15, answered question by question in the session: every recommendation approved, with one change: the instrumentation files are src/instrumentation.server.ts and src/instrumentation.client.ts (also .js and .mjs), with no entry.* files. Recorded as decision-48 (folder middleware), decision-49 (instrumentation files, features 2, 5 and 6), decision-50 (router hooks), decision-51 (submission()) and decision-52 (createDevHandler()); TASK-294 to TASK-300 updated to the approved shapes. No feature was rejected or deferred (AC #4). Render customization, raised in the review: no render file; its two gaps became TASK-306.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The M10 extension points have an approved API: doc-8 (approved), decision-48 to decision-52, and TASK-294 to TASK-300 rewritten to the approved shapes and acceptance criteria. Follow-ups: TASK-306 (crawler responses and streaming timeout) and TASK-305 (island load failures, found while researching).
<!-- SECTION:FINAL_SUMMARY:END -->
