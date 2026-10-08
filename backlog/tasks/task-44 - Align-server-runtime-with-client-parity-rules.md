---
id: TASK-44
title: Align server runtime with client parity rules
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 13:28'
updated_date: '2026-10-08 13:50'
labels: []
milestone: m-2
dependencies:
  - TASK-13
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client DOM runtime (TASK-13) settled value-rendering rules that SSR output must match exactly, otherwise hydration mismatches and inconsistent HTML follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server text() renders booleans as empty (like client setText)
- [ ] #2 server attr() writes aria-* and enumerated attributes (draggable, spellcheck, contenteditable, translate…) as "true"/"false" and removes plain boolean attributes on false (like client setAttr)
- [ ] #3 index.server.ts exports server versions of ref, Portal (renders nothing / or into a deferred region: decide and document), and Dynamic
- [ ] #4 parity tests compare server output with client DOM serialization for the same inputs
- [ ] #5 submit() registers in-flight submissions with the core busy registry (decision-20), once Spark's TASK-17 exposes it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/attrs.ts: attr() writes aria-* and enumerated (Booleanish) attributes as "true"/"false" (duplicated table from dom/attributes.ts BOOLEANISH, guarded by a parity test instead of editing Spark's file); plain boolean attributes keep present/absent. spreadAttrs inherits it; skip property-only indeterminate like client spread.
2. server text(): already renders booleans/nullish as "" (verify with parity test).
3. server/public.ts: server ref() (reads undefined, writes ignored), Portal (renders nothing on the server: content is client-only, rendered when the island mounts/hydrates; children not evaluated), Dynamic (component -> createComponent; string tag -> element with spreadAttrs + children/innerHTML/textContent, void tags self-closing, invalid tag names rejected). Test that lumen and lumen (node) export the same names.
4. server/parity.test.ts (happy-dom): same inputs through server helpers and client writers (setText, setAttr, setClass, setStyle, spread, Dynamic), comparing serialized HTML (server HTML parsed and re-serialized).
5. submit(): register in-flight submissions with core busy registry when TASK-17 exposes it; otherwise leave AC #5 open with a note. Verify decision-20 result semantics (failure resolves, only unexpected errors reject) with tests.
6. pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->
