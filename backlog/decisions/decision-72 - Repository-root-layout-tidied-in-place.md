---
id: decision-72
title: 'Repository root layout, tidied in place'
date: '2026-10-20 21:20'
status: accepted
---
## Context

The user found the repository root messy (2026-10-20). It holds ten tracked folders and about 22 files, plus local build output (`dist/`, `data/`). Having `crates/`, `fuzz/`, `packages/`, `examples/` and `benchmarks/` at the root is the usual layout for Rust and JavaScript projects such as oxc, rolldown and biome. A deeper regroup into `rust/` and `tools/` would cut the top level further, but it is less conventional.

## Decision

Approved by the user on 2026-10-20: tidy in place.

- `fuzz/` moves to `crates/fuzz/`.
- `evals/` moves to `benchmarks/evals/`.
- `CONTRIBUTING.md`, `SECURITY.md` and `renovate.json` move to `.github/`, where GitHub and Renovate also look for them.
- Builds stop writing to the root:
  - The website build goes to `apps/web/dist/`.
  - The bookshelf example keeps its database in its own folder.

The top level after the move is `.github/`, `apps/`, `backlog/`, `benchmarks/`, `crates/`, `examples/`, `packages/` and `scripts/`, plus the root configuration files.

## Consequences

- The moves touch CI workflows, scripts, docs links, the AGENTS.md ownership table and the release script. The task updates all of them.
- It runs only when no worker is active, because it moves paths that other agents own.
- `crates/fuzz/` stays a cargo-fuzz workspace of its own: the root `Cargo.toml` excludes it from `crates/*`.
- Done in TASK-484 (2026-10-20). Nothing writes the root `data/` any more. The bookshelf example keeps its database in its own `data/` folder; the root copy was left by an early run from the root. The root `dist/` and `data/` folders in an existing checkout are leftovers and can be deleted.
