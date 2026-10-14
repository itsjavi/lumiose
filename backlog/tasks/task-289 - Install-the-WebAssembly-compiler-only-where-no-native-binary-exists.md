---
id: TASK-289
title: Install the WebAssembly compiler only where no native binary exists
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - packaging
  - compiler
dependencies: []
priority: low
ordinal: 291000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md). A fresh pnpm install on darwin-arm64 installs @lumiose/compiler-wasm32-wasi (11.4 MB) next to @lumiose/compiler-darwin-arm64 (12.6 MB), because the wasm package has no os/cpu constraint. Check how napi-rs projects avoid it (for example, a wasm fallback that is not an optional dependency of the main package) without breaking platforms that need it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fresh install on a platform with a native binary does not install the wasm package, and the wasm fallback still works where it is needed
<!-- AC:END -->
