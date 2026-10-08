---
id: TASK-5
title: Scaffold the monorepo
status: In Progress
assignee:
  - '@Lux'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:21'
labels: []
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every other task needs a shared workspace: a pnpm workspace for the TS packages and a Cargo workspace for the Rust crates. TS 7 is first-class, and oxlint, oxfmt and Vitest are configured from day one, so workers start from a consistent baseline (spec §3.1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pnpm install succeeds; the workspace contains packages/lumen with the subpath exports from spec §3.1 (lumen, lumen/dom, lumen/server, lumen/router, lumen/jsx-runtime, lumen/vite) as stubs
- [ ] #2 cargo build and cargo test succeed for crates lumen_compiler, lumen_css, lumen_napi and lumen_wasm (stubs)
- [ ] #3 TypeScript 7 type-checks all packages via a root script; oxlint, oxfmt and vitest run from root scripts
- [ ] #4 AGENTS.md documents the workspace layout, ownership per agent, and the pnpm-install lock rule
<!-- AC:END -->
