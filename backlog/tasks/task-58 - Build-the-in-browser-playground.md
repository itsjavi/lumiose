---
id: TASK-58
title: Build the in-browser playground at /playground
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 15:58'
labels: []
milestone: m-5
dependencies:
  - TASK-59
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: low
ordinal: 58000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A playground lets people and agents try .stsx instantly: edit code, see compiled output, CSS and the running result. apps/playground is its own app served under /playground of the website, sharing the design system.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 apps/playground built with base /playground/: editor for .stsx (Monaco or CodeMirror with the stsx grammar), live preview iframe running the compiled client output against the lumen runtime, tabs for compiled JS (client/server), CSS and diagnostics
- [ ] #2 Uses the wasm compiler build in the browser (no server); shareable URLs (state in the hash); uses @lumen/site-kit header/footer so it feels like part of the site; linked from / and /docs
<!-- AC:END -->
