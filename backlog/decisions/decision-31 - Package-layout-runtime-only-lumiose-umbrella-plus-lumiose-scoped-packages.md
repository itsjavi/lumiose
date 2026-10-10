---
id: decision-31
title: 'Package layout: runtime-only lumiose umbrella plus @lumiose scoped packages'
date: '2026-10-10 00:22'
status: accepted
---
## Context

Today one `lumen` package carries the runtime and all tooling, so a production install pulls about 139 packages (fullstack benchmark) including the compiler, the MCP SDK, svgo and yaml. The user wanted "scoped packages for a modular ecosystem and an umbrella package for the essentials for client and server side" and approved this layout on 2026-10-10 (decision-30 names: `lumiose`, user-owned `@lumiose` scope).

## Decision

- **`lumiose`** (unscoped umbrella): the runtime only — core (`lumiose`), `lumiose/dom` (+ dev-only `lumiose/dom/hot`), `lumiose/server`, `lumiose/router`, the app runtime, `lumiose/jsx-runtime`, `lumiose/env`. Almost no dependencies. Ships prebuilt JS + `.d.ts`, so Node servers can keep it external. The runtime stays in one package (no `@lumiose/core` + `@lumiose/dom` split) to avoid duplicate signal-graph instances.
- **Scoped, optional or dev-time:** `@lumiose/vite` (plugin), `@lumiose/cli` (check, lint, fmt, docs, mcp, build/dev/preview commands), `@lumiose/compiler` (+ `@lumiose/compiler-<platform>` optional dependencies with the napi binaries, and the wasm build), `@lumiose/adapter-node` (and later cloudflare/vercel/netlify), `@lumiose/language-server`, `@lumiose/eslint-plugin`, `@lumiose/prettier-plugin`, `@lumiose/testing`, `create-lumiose`.
- New projects depend on `lumiose` at runtime and on `@lumiose/vite` and `@lumiose/cli` as dev dependencies.

## Consequences

- The compiler emits imports of `lumiose/*` subpaths; tooling imports from the scoped packages.
- Test files and fixtures are excluded from published files; MCP SDK, svgo and yaml leave the runtime install.
- Implemented in TASK-39, after the rename (TASK-182).
