---
id: TASK-11
title: Build the napi bindings and the Vite plugin
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 14:36'
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
- [x] #1 @lumen/compiler napi package builds for the host platform, with a wasm32 fallback build script
- [x] #2 lumen/vite transforms .stsx/.tsx for client and ssr environments (enforce pre, Rust-side filter, node_modules excluded, Vite JSX/TS transform disabled for Lumen files), with source maps and diagnostics in the Vite overlay; HMR remounts component modules
- [x] #3 A small example app (counter + todo) runs in vite dev and vite build, verified in a browser
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. lumen/vite (packages/lumen/src/vite/index.ts): enforce pre; transform with a Rolldown hook filter (include /\.(?:stsx|tsx)$/, exclude node_modules); target from this.environment.config.consumer; return { code, map, moduleType: 'js' }; diagnostics -> this.warn/this.error with offsets (Vite builds loc + frame).
2. Config: oxc.exclude = [/\.js$/, Lumen files] unless the user set oxc include/exclude/false; configEnvironment: explicit resolve.conditions per consumer (browser/node defaults), resolve.noExternal ['lumen'] for server consumers, optimizeDeps.exclude for lumen entries.
3. HMR v1: client modules importing mount from lumen/dom (app entries) self-accept and import lumen/dom through a virtual wrapper whose mount() disposes the previous root of the same container; style-module ids load as empty CSS until TASK-45.
4. @lumen/compiler build:wasm (napi wasm32-wasip1-threads; emnapi v2 alpha required by napi-build 2.6).
5. examples/vite-counter (counter + todos), Playwright e2e on vite dev and vite build + preview; Vitest integration test of the plugin on a real dev server.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (TASK-11 done):
- Plugin: packages/lumen/src/vite/index.ts. Transform filter is the native (Rolldown) hook filter, so non-Lumen modules never cross into JS. Target = server when this.environment.config.consumer === 'server'. Vite's OXC transform is told to skip Lumen modules via oxc.exclude (default /\.js$/ kept); verified that .ts files still go through vite:oxc. resolve.conditions are set explicitly per consumer (Vite's defaultClientConditions/defaultServerConditions unless the user set them): lumen -> src/index.ts on the client, src/index.server.ts on ssr. lumen is noExternal in server environments (one runtime instance with compiled code; Node cannot type-strip .ts under node_modules) and excluded from dep pre-bundling (lumen, lumen/dom, lumen/dom/hydrate, lumen/server, lumen/router, @lumen/compiler).
- Diagnostics: warnings -> this.warn; errors -> this.error with the UTF-16 offset of the first error (others appended) and help text; dev overlay and build both show plugin, LUMxxxx code, file:line:col and a code frame (screenshot backlog/assets/task-11-vite-error-overlay.png).
- HMR v1 (documented in the plugin header): app entries (client modules that import mount from lumen/dom) become self-accepting boundaries, their lumen/dom import goes through virtual:lumen/hmr-dom whose mount() disposes the previous root of the same container; any edit below the entry re-runs it (Vite invalidates the importer chain) and re-mounts the app. Component state resets; module signals of unchanged modules survive. Per-component hot replacement is a later improvement. Once a public mount/hydrate API exists (TASK-18/25) the detection regex (IMPORTS_MOUNT) must include it.
- Styles: <file>?lumen&type=style&lang.css loads as empty CSS until TASK-45 (no crash for .stsx with style blocks).
- WASI fallback: pnpm --filter @lumen/compiler build:wasm (napi build --target wasm32-wasip1-threads). Requires rustup target add wasm32-wasip1-threads (installed for 1.98.1) and emnapi 2.0.0-alpha.5 (napi-build 2.6 links emnapi_create_env, only in emnapi v2); runtime deps @napi-rs/wasm-runtime 1.2.4 + @emnapi/core/runtime 2.0.0-alpha.5. The generated index.js already falls back to compiler.wasi.cjs; artifacts are gitignored in packages/compiler. Verified NAPI_RS_FORCE_WASI=error loads wasm32-wasi and compiles; packages/compiler/test/wasi.test.ts compares wasm vs native output (skipped when not built).
- Example: examples/vite-counter (private): counter + todos, main.tsx mounts with lumen/dom mount. pnpm --filter @lumen-examples/vite-counter test:e2e runs Playwright (chromium) against vite dev and vite build + vite preview.
- Deps (deps.lock taken/released): examples/vite-counter: lumen workspace, vite ^8.3.4, @playwright/test 1.63.0, @types/node; packages/compiler: @napi-rs/wasm-runtime 1.2.4, @emnapi/core + @emnapi/runtime 2.0.0-alpha.5 (deps), emnapi 2.0.0-alpha.5 (dev). Playwright chromium installed.
- Evidence: Playwright 6 passed / 2 skipped-by-design (dev: counter, todos, HMR remount without reload (window marker kept, one <main>), overlay with LUM1001 + frame; preview: counter, todos). Vitest packages/lumen/src/vite/plugin.test.ts 7 tests on a real Vite dev server (client/ssr targets, source map sources+mappings, conditions/noExternal/optimizeDeps, oxc exclusion, error loc+frame, warnings, HMR entry rewrite). vite build fails with a framed LUM1001 on a broken file; vite build --ssr of the example renders HTML through renderToString. Screenshots: backlog/assets/task-11-vite-counter-preview.png, backlog/assets/task-11-vite-error-overlay.png. tsc clean for lumen, compiler, example; oxlint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen/vite compiles .stsx/.tsx for client and ssr Vite 8 environments (native hook filter, enforce pre, Vite OXC skipped for Lumen files, source maps, LUM diagnostics in the overlay and build output with code frames), resolves lumen per consumer, and re-mounts apps on HMR through entry boundaries. @lumen/compiler gains a WASI fallback build. examples/vite-counter runs in vite dev and build+preview, verified with Playwright in Chromium (screenshots in backlog/assets).
<!-- SECTION:FINAL_SUMMARY:END -->
