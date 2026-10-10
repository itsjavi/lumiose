---
id: TASK-182
title: Rename Lumen to Lumiose everywhere (decision-30)
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 00:20'
updated_date: '2026-10-10 00:54'
labels:
  - rename
  - release
dependencies: []
priority: high
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: rename the package, all references and the deploy path from lumen to lumios. See decision-30 for scope and exceptions. Also (user): the website should not mention TypeScript 7 everywhere — say once that Lumios is TypeScript-first and compatible with TypeScript 7.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: target name changed by the user to lumiose (unscoped lumios is taken on npm).

Beacon (2026-10-10): renamed to Lumiose (Lux's change from lumios; no intermediate lumios state committed). Scripted, case-preserving rename (lumen/Lumen/LUMEN -> lumiose/Lumiose/LUMIOSE) over all tracked text files except backlog history, vendored gbapu and krausest code, and the lockfiles (regenerated); git mv for packages/lumen, crates/lumen_*, benchmarks/fullstack/apps/lumen, benchmarks/ssr/src/lumen. Benchmark and eval result files were relabeled too (app ids and descriptions), keeping their JSON formatting. Website: one TypeScript 7 mention (landing: 'TypeScript-first, compatible with TypeScript 7'); docs say TypeScript-first, with typescript@^7 kept as the install requirement. Regenerated: Rust goldens (UPDATE_GOLDEN, UPDATE_FIXTURES: offsets shift by the longer name), the vscode grammar snapshot, docs (docs:gen), example screenshots (chiptune logo now has O and S glyphs). backlog docs doc-1..doc-5 updated via 'backlog doc update' (doc-1 file renamed by the CLI), project name via 'backlog config set'. Validation: pnpm install, cargo test --workspace, pnpm typecheck/lint/fmt:examples/test (1431), all 9 Playwright suites, build:site --base /lumiose/ + crawl 174 URLs 0 broken + Playwright visit of every page, final git grep. Remaining 'lumen': github.com/itsjavi/lumen (REPOSITORY in apps/web/src/content/showcase.ts, eslint-plugin rule docs URL, doc-3) until the GitHub repo is renamed; historical backlog tasks/decisions/milestones and backlog/assets screenshots; the repo folder on disk (lumen-jsx). Housekeeping: stopped 15 orphaned dev servers from 8 h old eval runs (/var/folders/.../lumen-evals/runs/*) that held the e2e ports.

Pushed 477c467, d728435, 436a601 (cargo fmt for the longer crate names). CI 38010339098 green on all 6 jobs, Binaries and Pages green; the live site (still https://itsjavi.com/lumen/ until the repo is renamed) shows Lumiose.
<!-- SECTION:NOTES:END -->
