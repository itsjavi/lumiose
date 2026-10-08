---
id: TASK-11
title: Build the napi bindings and the Vite plugin
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:11'
labels: []
milestone: m-1
dependencies:
  - TASK-9
  - TASK-14
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The compiler must plug into Vite 8 / Rolldown as a JS plugin calling the Rust core through napi, so .stsx and .tsx apps run in dev and build with both client and server targets (decision-5, spec §5.5). CSS virtual modules and CSS HMR are added in TASK-45 once lumen_css is integrated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @lumen/compiler napi package builds for the host platform, with a wasm32 fallback build script
- [ ] #2 lumen/vite transforms .stsx/.tsx for client and ssr environments (enforce pre, Rust-side filter, node_modules excluded, Vite JSX/TS transform disabled for Lumen files), with source maps and diagnostics in the Vite overlay; HMR remounts component modules
- [ ] #3 A small example app (counter + todo) runs in vite dev and vite build, verified in a browser
<!-- AC:END -->
