---
id: TASK-161
title: 'CI on Linux, macOS and Windows; native binaries per platform'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-09 11:53'
updated_date: '2026-10-09 14:42'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon — RESUME (checkpoint 2026-10-09, In Progress). Done and pushed: .github/workflows/ci.yml (check + e2e on ubuntu/macos/windows; Linux runs every Playwright suite, macOS/Windows vite-counter + islands-e2e), binaries.yml (6 napi targets + lumen_wasm artifacts with smoke tests: ALL GREEN on run 37929413798), .github/scripts/smoke-*.mjs, CONTRIBUTING.md + README link, .gitattributes (LF; fixed Windows fmt:examples), concurrency (main pushes not cancelled), fixes for CI: cargo fmt (components.rs, lumen_content headings test), clippy needless_borrow (components.rs), cli.test.ts envelope test 60 s timeout. Observed CI failures not yet fixed (file/route to owners): (1) apps/web content.test 'links only to pages and anchors that exist': reference/vite.md and reference/adapter-node.md link to /docs/concepts/security#request-body-limits, but security.md has it as bold text, not a heading (TASK-167 author); (2) vite-counter 'compiler errors show in the dev overlay' fails on Linux CI only (overlay still present after restoring the file; passes on macOS) — investigate (CSS-only HMR path after an error edit?); (3) Pages workflow fails on a clean checkout: apps/playground scripts/assets.ts vite build needs .lumen/tsconfig.generated.json (Beacon); (4) lumen fmt --check prints 'undefined' after its summary (Beacon). Windows check results after the .gitattributes fix not seen yet. Next: gh run list --workflow CI; read failed job logs (gh api repos/itsjavi/lumen/actions/jobs/<id>/logs --allow-escape-sequences); fix own-area failures, file tasks for the rest; then tick ACs.

Beacon (2026-10-09): (3) Pages on a clean checkout: fixed in 472cbae (apps/playground/scripts/assets.ts writes .lumen/tsconfig.generated.json before its vite build); Pages has been green since (e.g. runs 37929224785, 37944851880). (4) 'undefined' after lumen fmt --check: printed by pnpm 11 itself whenever 'pnpm --filter … exec' runs a failing command (reproduced with exec node -e 'process.exitCode=1'), not by lumen. fmt:examples now runs scripts/fmt-examples.ts, which calls the CLI in-process per example with a prefixed summary line each and one failure summary (4207961, test in cli/fmt/fmt.test.ts). Note: examples/spa-chiptune/src/ui/TrackerView.stsx is currently modified and unformatted in the working tree (someone's WIP); fmt:examples will flag it if committed as is.
<!-- SECTION:NOTES:END -->
