---
id: TASK-7
title: Implement the reactive core
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Signals are the foundation of every update path, and the core sets Lumen's performance and memory ceiling (decision-8).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 signal, computed, effect, store, untrack, batch, flushSync, onMount, onCleanup, lifetime, createContext/provide/inject behave per spec §4.3 and §6.1-6.2
- [ ] #2 The algorithm follows alien-signals (intrusive links, depsTail reuse, push-pull flags, no recursion), vendored with MIT attribution; unobserved computeds unlink
- [ ] #3 Property-based tests compare it against a naive reference implementation; unit tests cover owners, cleanup, context and batching
- [ ] #4 A run-scoped subscriber can be paused and resumed (needed for $await)
<!-- AC:END -->
