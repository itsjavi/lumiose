---
id: TASK-161
title: 'CI on Linux, macOS and Windows; native binaries per platform'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 11:53'
labels:
  - ci
  - release
milestone: m-7
dependencies: []
priority: high
ordinal: 161000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: drive production hardening. The repo now has a private GitHub remote (origin itsjavi/lumen) with Pages via GitHub Actions. Add CI workflows: pnpm check pieces (build:compiler, typecheck, lint, fmt:examples, size, vitest, cargo test/clippy/fmt) on ubuntu, macos and windows; Playwright suites on Linux (all) and a smoke subset on macOS/Windows; caching for pnpm and cargo. Build the napi binary for darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu, linux-x64-musl, win32-x64-msvc plus lumen_wasm as workflow artifacts (publishing waits for TASK-39 package names). Fix Windows/cross-platform failures in your area; file tasks for other areas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI workflow green on all three OSes (or remaining failures filed as tasks with owners); runs on push/PR to main
- [ ] #2 Native binaries for the 6 targets and the wasm build produced as artifacts by a workflow, with a smoke test loading each where the runner allows
- [ ] #3 Docs: a CONTRIBUTING/README section on CI and building binaries
<!-- AC:END -->
