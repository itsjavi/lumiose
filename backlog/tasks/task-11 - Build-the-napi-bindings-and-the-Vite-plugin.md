---
id: TASK-11
title: Build the napi bindings and the Vite plugin
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-9
  - TASK-10
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The compiler must plug into Vite 8 / Rolldown as a JS plugin that calls the Rust core through napi, so that .stsx and .tsx apps run in dev and build (decision-5, spec §5.5).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @lumen/compiler napi package builds for the host platform, with a wasm32 fallback build script
- [ ] #2 lumen/vite transforms .stsx/.tsx (enforce pre, Rust-side filter, node_modules excluded, Vite JSX transform disabled for Lumen files), serves CSS virtual modules and handles HMR (CSS-only for style edits)
- [ ] #3 A small example app (counter + todo with scoped styles and $tokens) runs in vite dev and vite build, verified in a browser
<!-- AC:END -->
