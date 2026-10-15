---
id: TASK-311
title: Fuzz the compiler crates nightly
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 07:41'
labels:
  - security
  - fuzzing
milestone: m-11
dependencies: []
priority: medium
ordinal: 313000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-56: cargo-fuzz targets for the compiler crates (crates/** except lumiose_css, lumiose_svg and lumiose_content): the .stsx/.tsx parser and masking, the JSX transform and SSR codegen, with corpora seeded from the test fixtures. A scheduled nightly GitHub workflow runs every fuzz target of the workspace (also Halo's) for a bounded time and reports crashes; it does not run on push.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fuzz targets cover the parser, masking, the JSX transform and SSR codegen, with seeded corpora
- [x] #2 A nightly scheduled workflow runs all workspace fuzz targets and fails visibly on a crash
- [x] #3 CONTRIBUTING.md explains how to run a target locally and reproduce a crash
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): reassigned to Spark for the unattended M10/M11 run. New worker sessions cannot be started from automated turns, and Spark's session was idle with its own queue done; Spark may edit this task's area (crates, CI workflows, release scripts) for it, since no Photon or Halo worker is active.

Spark started 2026-10-15 (batch 4, reassigned from Photon).

Implementation (Spark, batch 4):
- fuzz/: a cargo-fuzz workspace of its own (so the main workspace never builds libFuzzer), libfuzzer-sys pinned =0.4.13 in its [workspace.dependencies], Cargo.lock committed. Targets: scan (scan_kind as .stsx and .tsx; asserts the masking invariant: same UTF-8 length, same line breaks, same UTF-16 length, spans in bounds, identity without blocks), compile_client (compile() for Target::Client as .stsx and .tsx: scanning, the JSX transform, style blocks, client codegen), compile_server (Target::Server: SSR codegen). Inputs that are not UTF-8 are skipped.
- fuzz/seed.sh seeds fuzz/corpus/<target> from crates/lumiose_compiler/tests/fixtures (.stsx, .tsx, .ts; 64 files), named after their paths; TASK-312 adds its crates there. Corpus, artifacts and target are gitignored (fuzz/.gitignore).
- .github/workflows/fuzz.yml: schedule (03:23 UTC daily) and workflow_dispatch (seconds per target, property cases), never on push. A first job lists the [[bin]] targets of fuzz/Cargo.toml, so new targets (TASK-312) join the matrix without editing the workflow; each target job installs nightly and cargo-fuzz (taiki-e/install-action), restores and saves its corpus (actions/cache v6.1.0, new pin), seeds it, fuzzes 600 s with ASan, and uploads fuzz/artifacts/<target> on failure. A properties job runs pnpm --filter lumiose test:properties 200000 (Nova's TASK-313). actionlint passes.
- Local runs (stable, -s none, macOS needs -Clink-arg=-undefined -Clink-arg=dynamic_lookup because oxc_sourcemap also builds a dylib): 60 s each, scan 262k runs, compile_client 151k, compile_server 155k; no crash. Property tests at 5000 cases pass.
- Not verified here: the workflow itself on GitHub (nothing is pushed in this run) and the nightly/ASan build; trigger it once with workflow_dispatch after the next push.
- Noticed: src/core/property.test.ts (reactive graph tests) is outside the .property.test naming, so test:properties does not raise its case count.
- Docs: CONTRIBUTING.md (Fuzzing: run, macOS flag, replay, tmin; the nightly workflow under Continuous integration), SECURITY.md (How Lumiose is checked).

2026-10-15: first run triggered by hand on the user's request: https://github.com/itsjavi/lumiose/actions/runs/38700307868
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
cargo-fuzz targets for the compiler's scanner/masking (with the masking invariant), client compile and server compile, seeded from the fixtures, and a nightly fuzz workflow that runs every fuzz/ target with ASan plus the property tests at 200000 cases; CONTRIBUTING.md and SECURITY.md updated. The workflow's first real run happens after the next push.
<!-- SECTION:FINAL_SUMMARY:END -->
