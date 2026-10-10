---
id: TASK-193
title: 'Scoped state: one instance per request, shared by islands, sent to the browser'
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 03:33'
labels:
  - state
  - core
  - islands
dependencies:
  - TASK-190
priority: medium
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-6 §A, decision-33. A factory-defined state that runs lazily once per scope: per request on the server, once per page in the browser (shared by islands and the SPA tree), fresh per test. Seeded by its factory from request APIs; states instantiated during the request and reachable from client code are serialized once per page (compiler-assigned id, existing serializer), streamed with their chunk, and restored before islands hydrate. Name provisional until TASK-190. Touches core/dom (Spark), src/server serialization (Nova's area) and the compiler id (Photon): Lux coordinates the cross-area edits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server: one instance per request, never shared across requests; browser: one per page, the same instance in every island
- [ ] #2 Server values restored before hydration with no mismatch; only client-reachable states are sent; plain-data rule enforced with a diagnostic
- [ ] #3 Streaming: a state first used in a late boundary arrives with that chunk; tests cover SSR, hydration, islands, SPA and per-test isolation
- [ ] #4 Docs: Sharing state page and reference updated (security note: sent state is public); LUM4008 guidance points to it
<!-- AC:END -->
