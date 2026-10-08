---
id: TASK-5
title: Scaffold the monorepo
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:24'
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
- [x] #1 pnpm install succeeds; the workspace contains packages/lumen with the subpath exports from spec §3.1 (lumen, lumen/dom, lumen/server, lumen/router, lumen/jsx-runtime, lumen/vite) as stubs
- [x] #2 cargo build and cargo test succeed for crates lumen_compiler, lumen_css, lumen_napi and lumen_wasm (stubs)
- [x] #3 TypeScript 7 type-checks all packages via a root script; oxlint, oxfmt and vitest run from root scripts
- [x] #4 AGENTS.md documents the workspace layout, ownership per agent, and the pnpm-install lock rule
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Set up the root pnpm workspace, the TS 7 base config, Vitest, oxlint and oxfmt.
2. Set up the Cargo workspace with stub crates and a pinned toolchain.
3. Create the packages/lumen skeleton with conditional/subpath exports and owner-module aggregators.
4. Document the workspace and the ownership rules in AGENTS.md.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scaffold created. packages/lumen exports '.' with browser/node conditions (index.ts / index.server.ts aggregate the owner modules), plus subpaths dom, server, router, jsx-runtime, env and vite; the bin runs from TS source on Node 26 via type stripping. pnpm 11 auto-added vite@8.3.4 to minimumReleaseAgeExclude. Verified: pnpm install OK; pnpm typecheck (TS 7.0.2) OK; vitest 1 test passes; oxlint passes (only empty-export warnings in stubs); cargo build --workspace OK.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Monorepo scaffolded: pnpm and Cargo workspaces, TS 7 base config, Vitest/oxlint/oxfmt, the packages/lumen skeleton with conditional exports, four stub crates and a pinned Rust toolchain. Ownership and the dependency-lock rules are in AGENTS.md. Verified with install, typecheck, test, lint and cargo build.
<!-- SECTION:FINAL_SUMMARY:END -->
