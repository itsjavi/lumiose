---
id: TASK-15
title: Compile async components and island call sites
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:10'
labels: []
milestone: m-2
dependencies:
  - TASK-9
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Async components and islands both need compile-time support: the await rewrite with replay keys, and island(ref, …) call sites with manifests (decisions 9 and 13, spec §4.4, §5.4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 await is rewritten to $await only where the nearest function is the component; for await is supported; await using raises LUM1007; $component wrapping
- [ ] #2 client:* usage compiles to island(ref, X, props, strategy, slot) on the server and is stripped on the client; LUM4001; the island manifest is emitted via the Vite plugin
- [ ] #3 Golden fixtures
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: use the amended $await shape from doc-2 §4: (await $await(() => e, n))() plus try { … } finally { $leave() } around async component bodies.

Lux: emit $async(async function X …) around async component definitions (contract doc-2 §4); import $async from lumen/dom or lumen/server per target.

Photon (from TASK-9): analysis already records each component's await sites in source order (CompileMeta.components[].await_sites, AwaitExpression + for await), i.e. the site indices of the $await rewrite. In the client codegen, enter_component/leave_component (codegen/client/props.rs, called from visit_function/visit_arrow_function_expression in codegen/client/mod.rs) are the place to wrap the body in try/finally $leave(). client:* attributes are dropped from component props on the client today; awaited plain values (m.name in doc-2 §5.4) currently compile as dynamic member reads (insert(() => m.name)).
<!-- SECTION:NOTES:END -->
