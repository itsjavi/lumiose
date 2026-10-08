---
id: TASK-10
title: 'Implement the CSS pipeline: placement scopes and $name constants'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-8
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Styles are first-class in Lumen. Scoping by placement, the global attribute and build-time constants all have to compile to static CSS with no runtime (decisions 12 and 14).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css on pinned Lightning CSS: per-scope tokens on every element in scope, last-compound selector rewrite, :global/:deep, scoped keyframes, file-then-component ordering, targets and minification
- [ ] #2 $ref resolution via oxc_semantic and constant folding, including imported consts requested from the host; $-only imports removed from the JS; cssDeps reported
- [ ] #3 Class passthrough: call sites pass $$scope and children apply it wherever props.class is applied
- [ ] #4 Diagnostics LUM3005, LUM3008, LUM3009 and LUM3012; golden fixtures
<!-- AC:END -->
