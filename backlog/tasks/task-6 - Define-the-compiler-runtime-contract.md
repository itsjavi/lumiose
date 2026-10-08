---
id: TASK-6
title: Define the compiler-runtime contract
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon (compiler) and Spark (runtime) work in parallel. The exact set of runtime functions that compiled code imports, with their semantics and golden input/output examples, is the interface between them, so it must be fixed before codegen and runtime implementation diverge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A backlog doc lists every runtime import used by client, hydrate and server output, with signatures and semantics
- [ ] #2 A typed stub module in packages/lumen declares these functions, so compiled output type-checks against it
- [ ] #3 Golden examples (.stsx in, client/server JS + CSS out) cover templates, bindings, events, lists, branches, selector, components and props, styles and $refs, async/$await, islands
<!-- AC:END -->
