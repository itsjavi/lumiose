---
id: TASK-58
title: Build the in-browser playground at /playground
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 22:38'
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
- [x] #1 apps/playground built with base /playground/: editor for .stsx (Monaco or CodeMirror with the stsx grammar), live preview iframe running the compiled client output against the lumen runtime, tabs for compiled JS (client/server), CSS and diagnostics
- [x] #2 Uses the wasm compiler build in the browser (no server); shareable URLs (state in the hash); uses @lumen/site-kit header/footer so it feels like part of the site; linked from / and /docs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Make crates/lumen_wasm build for wasm32-unknown-unknown (getrandom wasm_js via target dep + root .cargo/config.toml cfg, approved by Lux) and give it the napi API: compile(source, filename, options) with napi option names (no cssTargets), compileSvg, diagnostics in the napi shape.
2. apps/playground: Lumen static app, base <site>/playground/, page = site-kit SiteHeader/Footer + Playground island (client:load).
3. scripts/assets.ts builds public/generated/{wasm (cargo + wasm-bindgen --target web), runtime.js (lumen + lumen/dom bundle)} before dev/build.
4. Editor: CodeMirror 6 with an .stsx language (TSX parser over masked text + CSS overlay on <style> contents, using the compiler's scanner once loaded); read-only JS/CSS output views; lint markers.
5. Preview: sandboxed srcdoc iframe; runtime + module as blob modules; mounts the default export; console/errors back to the parent.
6. Shareable URLs: #v1=<deflate-raw base64url JSON {code, tab}>.
7. Tests: vitest unit tests, Playwright e2e on the static build at /playground/ and /lumen/playground/, screenshots backlog/assets/task-58-*.png.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: Note for Photon (lumen_wasm API change, approved by Lux): compile(source, filename, options?) now takes the napi CompileOptions names (target, sourceMap, styleImport, emitCss, cssMinify, root, packages, modules; no cssTargets: lumen_css has no browserslist in wasm); new compileSvg(source, filename, {target, root}); results serialize like napi (diagnostic code as LUMxxxx plus docs topic, maps as plain objects). Browser build: lumen_wasm depends on getrandom (wasm_js) on wasm32-unknown-unknown, and the root .cargo/config.toml sets --cfg getrandom_backend="wasm_js". Build: cargo build -p lumen_wasm --release --target wasm32-unknown-unknown, then wasm-bindgen 0.2.129 --target web --no-typescript. The wasm is ~8 MB raw (opt-level s / wasm-opt could shrink it later).
Note for TASK-60 (deploy): building apps/playground needs rustup target wasm32-unknown-unknown and cargo install wasm-bindgen-cli --version 0.2.129 --locked in CI; build it with the site's LUMEN_BASE and copy apps/playground/dist/client to <site>/playground/. No COOP/COEP needed (single-threaded wasm).
Evidence: editor with .stsx highlighting (CSS inside <style>), compile on edit for client and server, Client JS/Server JS/CSS/Diagnostics tabs, lint markers, sandboxed live preview (interactive counter, todo form), console capture, shareable hash state (reload and new tab restore code and tab), base /playground/ and /lumen/playground/. Links: site-kit header nav (Docs, Playground) on / and /docs already points to /playground, and the landing hero has a Playground button. Screenshots: backlog/assets/task-58-preview-light.png, task-58-preview-dark.png, task-58-client.png, task-58-css.png, task-58-diagnostics.png, task-58-phone.png. Validation: cargo test/clippy/fmt -p lumen_wasm green; playground vitest 10 passed; Playwright 4 e2e + screenshots passed (Chromium, static build); lumen check clean; pnpm typecheck green; pnpm lint clean; pnpm test 1071 passed, with 1 failure: llms freshness, caused by other agents' uncommitted docs edits (data-and-actions, app, router), not TASK-58.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
apps/playground at <site>/playground/: a prerendered Lumen page (site-kit header and footer) with a Playground island. CodeMirror 6 editor with an .stsx language (TSX over masked text plus a CSS overlay, using the compiler's scanner); every edit compiles in the browser with the WebAssembly compiler (crates/lumen_wasm, now browser-buildable and with the napi option names, plus compileSvg) for client and server. Tabs: live preview (sandboxed iframe running the client output against the real lumen runtime, with console capture), Client JS, Server JS, CSS and Diagnostics (with editor lint markers and docs links). State lives in a shareable #v1= hash (deflate-raw, base64url). scripts/assets.ts builds the wasm and the preview runtime. Tests: unit (vitest), Playwright e2e on the static build at two bases, screenshots in backlog/assets/task-58-*.png.
<!-- SECTION:FINAL_SUMMARY:END -->
