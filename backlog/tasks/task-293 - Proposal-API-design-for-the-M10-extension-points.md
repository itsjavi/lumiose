---
id: TASK-293
title: 'Proposal: API design for the M10 extension points'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 02:21'
labels:
  - proposal
  - needs-decision
milestone: m-10
dependencies: []
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
- [ ] #1 A proposal covers the six features, each with a recommended shape, alternatives, prior art, rendering-mode behaviour and byte cost
- [ ] #2 The user's approval or requested changes are recorded per feature in this task
- [ ] #3 Approved shapes are recorded as decisions, and M10's implementation tasks are updated with them
- [ ] #4 Rejected or deferred features are recorded with the reason, and their tasks updated or closed
<!-- AC:END -->
