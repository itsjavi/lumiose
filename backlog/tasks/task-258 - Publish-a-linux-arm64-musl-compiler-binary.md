---
id: TASK-258
title: Publish a linux-arm64-musl compiler binary
status: To Do
assignee: []
created_date: '2026-10-12 20:01'
labels:
  - compiler
  - adapter
dependencies: []
ordinal: 260000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-249: @lumiose/compiler publishes Linux binaries for x64/arm64 on glibc and x64 on musl, but not arm64 on musl. lumiose build therefore fails on Alpine arm64 (node:24-alpine on Apple silicon, Graviton, Ampere, Hetzner ARM): no native binding, and the wasm32-wasi fallback package is not installed there (cpu: wasm32). The Docker guide works around it with a Debian build stage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aarch64-unknown-linux-musl is a napi target, built and smoke-tested in an Alpine arm64 container in binaries.yml
- [ ] #2 @lumiose/compiler-linux-arm64-musl is published with the other binaries and listed in optionalDependencies
- [ ] #3 docs/deploy/docker.md no longer needs the Debian build stage note (or keeps it as an option)
<!-- AC:END -->
