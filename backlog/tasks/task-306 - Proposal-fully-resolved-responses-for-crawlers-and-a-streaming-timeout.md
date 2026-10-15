---
id: TASK-306
title: 'Proposal: fully resolved responses for crawlers and a streaming timeout'
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-15 03:16'
labels:
  - proposal
  - needs-decision
milestone: m-10
dependencies: []
priority: low
ordinal: 308000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Raised in the TASK-293 review (2026-10-15). Lumiose has no hook to customise server rendering, and the user agreed not to add one as a file (no `render.server.ts`): `document.stsx` owns the HTML, middleware the headers and the response body, `csp: "strict"` the nonces, and `instrumentation.server.ts` the errors (decision-49). Two gaps remain, to design as small declarative options:

- **Fully resolved responses.** The render waits for every Suspense boundary only when prerendering (`resolveAll` in packages/lumiose/src/app/server/handler.ts). Crawlers and link-preview bots that do not run JavaScript get the shell with fallbacks and the streamed chunks after it. React Router's `entry.server` switches to `onAllReady` for bots. Candidate: a per-request switch that middleware can set (for example from the user agent).
- **Streaming timeout.** A slow boundary keeps the response open until the client goes away (the request's signal). React Router aborts pending boundaries after `streamTimeout`. Candidate: a `lumiose()` option, the boundary then rendering its error state.

Each new name needs the user's approval before it is recorded (AGENTS.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A proposal with recommended shapes, alternatives and prior art is reviewed by the user
- [ ] #2 Approved shapes are recorded as a decision, and an implementation task is created
<!-- AC:END -->
