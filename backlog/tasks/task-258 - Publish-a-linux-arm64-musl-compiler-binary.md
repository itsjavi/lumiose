---
id: TASK-258
title: Publish a linux-arm64-musl compiler binary
status: Done
assignee:
  - Photon
created_date: '2026-10-12 20:01'
updated_date: '2026-10-12 21:59'
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
- [x] #1 aarch64-unknown-linux-musl is a napi target, built and smoke-tested in an Alpine arm64 container in binaries.yml
- [x] #2 @lumiose/compiler-linux-arm64-musl is published with the other binaries and listed in optionalDependencies
- [x] #3 docs/deploy/docker.md no longer needs the Debian build stage note (or keeps it as an option)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user approved adding linux-arm64-musl to the compiler release matrix (runs only on releases). Verify locally with an arm64 node:alpine container (this machine is arm64); never trigger CI runs. Then simplify the Docker docs' Debian build-stage workaround if it is no longer needed.

Photon 2026-10-12: implemented.
- binaries.yml: new `napi-release` job (aarch64-unknown-linux-musl on ubuntu-22.04-arm, cargo-zigbuild, smoke test in node:24-alpine, native arm64). It runs only when the workflow gets `release: true` (a new boolean input of workflow_call and workflow_dispatch); release.yml passes it, so pushes that change the crates do not pay for it. The job reuses the napi job steps through a YAML alias (`steps: &napi-steps` / `*napi-steps`, supported by GitHub Actions since 2025-09); actionlint 1.7.12 passes and does type-check the aliased steps against the job matrix (verified by removing a matrix key: it reports matrix.zig).
- Package set: packages/compiler/npm/linux-arm64-musl (os linux, cpu arm64, libc musl), listed in @lumiose/compiler optionalDependencies and napi.targets; lockfile importer added. The napi loader (packages/compiler/index.js) already handles linux-arm64-musl (generic napi-rs template), so no loader change; `release.ts 0.2.1 --dry-run` bumps the new package; publish.ts/pack.ts pick it up through platformPackages() and a release fails if its binary is missing (the release run builds it).
- Local verification (no CI): built in an arm64 node:24-bookworm container exactly as the job does (rustup toolchain from rust-toolchain.toml, cargo-zigbuild 0.23.4 + ziglang, `napi build --target aarch64-unknown-linux-musl -x`): ELF aarch64 shared object, ldd shows only /lib/ld-musl-aarch64.so.1. In node:24-alpine arm64 (Alpine 3.24.2, Node 24.21.0): smoke-napi.mjs prints `ok: linux-arm64 (no glibc)`; three bookshelf .stsx files compile for client and server with 0 errors; pack.ts packed @lumiose/compiler-linux-arm64-musl@0.2.0 with the binary staged, and `npm install` of the packed @lumiose/compiler (override to the packed platform tarball) on Alpine arm64 installed compiler-linux-arm64-musl and the loader loaded the native binary (compile with CSS, 0 diagnostics).
- Docs: deploy/docker.md keeps the Debian build stage and notes it becomes optional from the release after 0.2.0 (also the Dockerfile comment); deploy/vps.md platform list updated; CONTRIBUTING.md binaries table (release-only row and the release input). examples/ssr-bookshelf/Dockerfile: its Debian build stage stays even after the release, because it compiles the binding from source in a glibc rust image (not from npm); a comment says so.
- Follow-up after the next release: switch the docker.md build stage to node:24-alpine (or keep Debian as an option) once @lumiose/compiler-linux-arm64-musl is on npm.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
aarch64-unknown-linux-musl is a napi target: @lumiose/compiler-linux-arm64-musl (packages/compiler/npm/linux-arm64-musl) is in optionalDependencies, napi.targets and the lockfile, and the release run of binaries.yml builds it in a new release-only napi-release job (ubuntu-22.04-arm, cargo-zigbuild, smoke test in node:24-alpine) that reuses the napi steps through a YAML alias; release.yml passes release: true. The generated loader already handled linux-arm64-musl; release.ts and pack.ts pick the package up. Verified locally in arm64 containers (built as the job does, smoke-napi in node:24-alpine, real .stsx files, npm install of the packed tarballs on Alpine arm64 loads the native binary); actionlint and the scripts tests pass. The Docker guide keeps its Debian build stage with a note that it becomes optional from the release after 0.2.0 (follow-up TASK-264); the bookshelf Dockerfile keeps Debian because it compiles the binding from source.
<!-- SECTION:FINAL_SUMMARY:END -->
