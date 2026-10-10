---
id: decision-30
title: Project renamed from Lumen to Lumios
date: '2026-10-10 00:20'
status: accepted
---
## Context

Decision-15 named the framework "lumen" for now. `lumen` and `create-lumen` are taken on npm. On 2026-10-10 the user decided: "the package and all references and deploy path should be renamed to lumios".

## Decision

- The framework is **Lumios**. Package `lumen` → `lumios`, scope `@lumen/*` → `@lumios/*`, `create-lumen` → `create-lumios`, CLI `lumen` → `lumios`, Vite plugin `lumen()` → `lumios()`, generated `.lumen/` → `.lumios/`, env vars `LUMEN_*` → `LUMIOS_*`, crates `lumen_*` → `lumios_*`, the VS Code extension and language server, docs, website, examples, benchmarks and evals. The site deploys under `/lumios/`.
- Kept: the `LUMxxxx` diagnostic codes (they still read as Lumios), `.stsx`, `data-l-*` scope tokens and `l:` hydration markers, vendored third-party code, and history (old backlog tasks and decisions keep their wording).
- Publishing: unscoped `lumios` is held on npm by an unused 0.0.1 placeholder (2022). Before publishing, either obtain the name from its owner or move the runtime package to the `@lumios` scope (TASK-39).

## Consequences

- Supersedes decision-15. The GitHub repository should be renamed to `lumios` so the Pages project path becomes `/lumios/`.
- Users of the VS Code extension reinstall it under the new id.
