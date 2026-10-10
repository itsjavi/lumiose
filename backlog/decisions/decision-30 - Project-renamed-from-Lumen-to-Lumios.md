---
id: decision-30
title: Project renamed from Lumen to Lumiose
date: '2026-10-10 00:20'
status: accepted
---
## Context

Decision-15 named the framework "lumen" for now. `lumen` and `create-lumen` are taken on npm. On 2026-10-10 the user decided to rename the package, all references and the deploy path, first to `lumiose`; since unscoped `lumiose` is held on npm by an unused placeholder, the user chose **`lumiose`** instead (`lumiose` and `create-lumiose` are free on npm; the user owns the `@lumiose` org).

## Decision

- The framework is **Lumiose**. Package `lumen` → `lumiose`, scope `@lumen/*` → `@lumiose/*`, `create-lumen` → `create-lumiose`, CLI `lumen` → `lumiose`, Vite plugin `lumen()` → `lumiose()`, generated `.lumen/` → `.lumiose/`, env vars `LUMEN_*` → `LUMIOSE_*`, crates `lumen_*` → `lumiose_*`, the VS Code extension and language server, docs, website, examples, benchmarks and evals. The site deploys under `/lumiose/`.
- Kept: the `LUMxxxx` diagnostic codes (they still read as Lumiose), `.stsx`, `data-l-*` scope tokens and `l:` hydration markers, vendored third-party code, and history (old backlog tasks and decisions keep their wording).

## Consequences

- Supersedes decision-15. The GitHub repository should be renamed to `lumiose` so the Pages project path becomes `/lumiose/`.
- Users of the VS Code extension reinstall it under the new id.
