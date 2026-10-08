---
id: decision-5
title: >-
  Rust compiler on OXC + Lightning CSS, shipped as napi-rs + a Vite/Rolldown
  plugin
date: '2026-10-08 10:28'
status: accepted
---
## Context

The Lumen compiler must not be JS-based. It has to integrate with the existing ecosystem: Vite 8 is built on Rolldown and already uses OXC for TS/JSX and Lightning CSS for CSS. Its main consumer is Vite 8.

TASK-2 found the following:
- Neither Rolldown nor Vite can load third-party Rust plugins. The supported path is a JS plugin that calls a napi addon, with hook filters evaluated on the Rust side.
- Solid's official compiler (`@dom-expressions/compiler`) and Vize (a Rust Vue toolchain) both prove the OXC + napi-rs + wasm stack. Vize adds Lightning CSS and an LSP.
- SWC only wins when Next.js or Rspack is the target.

## Decision

**Crates**
- `lumen_compiler`: the pure core. It uses `oxc_parser`, `oxc_semantic`, `oxc_ast_visit` `VisitMut` + `AstBuilder`, and `oxc_codegen` with source maps. It avoids `oxc_traverse`.
- `lumen_css`: scoping built on a Lightning CSS visitor.
- `lumen_napi`: napi-rs v3 platform packages plus a `wasm32-wasip1-threads` fallback.
- `lumen_wasm`: a single-threaded wasm-bindgen build for the playground.

**Version pinning.** Every `oxc_*` crate and `lightningcss` is pinned to an exact version. Upgrades happen deliberately and are guarded by a golden-fixture suite.

**`lumen/vite` plugin**
- Runs as `enforce: "pre"` with a Rust-side hook filter.
- Picks the client or server generator per Vite environment.
- Emits CSS as virtual modules.
- Returns code with TS types intact for Vite's OXC transform to strip.

**Relation to `@dom-expressions/compiler` (MIT).** It is the primary design reference. Code and fixtures are reused selectively with attribution. It is not forked.

**Style scoping.** Per-element `data-l-<hash>` attribute scoping with a (0,1,0) specificity bump. Native `@scope` is a later opt-in output.

## Consequences

- OXC is pre-1.0, so upgrades cost effort. This is mitigated by exact pins and fixtures.
- Crossing the JS boundary adds overhead compared with an in-core transform, roughly 50% by Evan You's estimate. That is acceptable for one pass per file. Revisit if Rolldown ships raw AST transfer for plugins.
- The same core powers the Vite plugin, the CLI (`lumen check`), the LSP, the MCP server and the browser playground.


_Accepted 2026-10-08 by Lux (architect) under the authority delegated in decision-16._
