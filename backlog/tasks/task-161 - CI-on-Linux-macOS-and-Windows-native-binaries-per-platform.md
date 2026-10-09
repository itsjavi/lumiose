---
id: TASK-161
title: 'CI on Linux, macOS and Windows; native binaries per platform'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-09 11:53'
updated_date: '2026-10-09 15:30'
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

Nova 2026-10-09 (run 37947716902): (1) Windows check — cause in my areas: temp roots from os.tmpdir() are 8.3 short paths (C:\Users\RUNNER~1) while Vite/Rolldown module ids are real long paths, so relative(root, id) left the project ('../..') and island chunks, SPA preloads and the CSS manifest came out empty; and the dev overlay's frame finder compared stack paths with '${root}/'. Fixes: build() and createDevServer() use realProjectRoot() (realpathSync.native: symlinks and short names resolved, also fixes projects under a symlinked path on every OS); app/dev/errors.ts reads file:// frames with fileURLToPath and compares paths separator- and drive-case-agnostically; tests use realpathSync.native for temp roots, build the /@fs/ URL from normalizePath, and skip the chmod-000 'unreadable directory' assertions on win32 (no POSIX permission bits). HALO: src/vite/content.test.ts (expects backslash paths for post.md.stsx ids, which are forward-slash Vite ids), svg tests (svg.dom.test 'hydrate inside an island', 'leaves .svg files of dependencies to Vite', '?url and ?raw', 'loads a project .svg', 'render inline…', 'sanitises with any SVGO config') are in your area. PHOTON: src/vite/plugin.test.ts (7 tests: island chunks, constants folding/HMR, linked packages, overlay locations, lumen export resolution), css-manifest.test.ts, custom-properties.test.ts, server-only.test.ts — same short-path/backslash pattern likely; realpathSync.native on the temp roots plus normalizePath on expected ids should fix most. (2) e2e ubuntu flake: in 4 runs the failing wait was always the client:idle Search island of a test's first page (the client:load ThemeToggle on the same page was hydrated), never reproducible on macOS (20/20). The loader called requestIdleCallback(start) without a timeout; headless Chromium on Linux CI may schedule no idle period for seconds, so the island stayed inert past the 5 s wait. Fix (dom/islands.ts, Spark's file, one change): requestIdleCallback(start, { timeout: 2000 }) — client:idle hydrates at the latest after 2 s, which also protects real pages whose main thread never idles; unit test dom/idle-trigger.test.ts; docs islands.md/dom.md; runtime size budgets OK.
<!-- SECTION:NOTES:END -->
