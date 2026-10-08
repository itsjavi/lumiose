---
id: TASK-58
title: Build the in-browser playground
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
labels: []
milestone: m-5
dependencies:
  - TASK-45
  - TASK-11
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A playground lets people and agents try .stsx instantly: edit code, see compiled output, CSS and the running result, using the wasm build of the compiler.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 apps/playground: editor for .stsx files (Monaco or CodeMirror with the stsx grammar), live preview iframe running the compiled client output against the lumen runtime, tabs for compiled JS (client/server), CSS and diagnostics
- [ ] #2 Uses the wasm compiler build in the browser (no server); shareable URLs (state in the hash); linked from the docs website
<!-- AC:END -->
