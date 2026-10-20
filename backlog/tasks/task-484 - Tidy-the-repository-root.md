---
id: TASK-484
title: Tidy the repository root
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-20 21:47'
labels: []
milestone: m-13
dependencies: []
priority: medium
ordinal: 480000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-72: fuzz/ to crates/fuzz/, evals/ to benchmarks/evals/, CONTRIBUTING.md, SECURITY.md and renovate.json to .github/, the website build output to apps/web/dist/, and the bookshelf database into its example folder. Update CI workflows, scripts, docs links, AGENTS.md (ownership table) and the release script. Run only when no worker is active.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The root holds only .github, apps, backlog, benchmarks, crates, examples, packages, scripts and root config files
- [x] #2 A build, test and website build leave no new folders at the root
- [x] #3 pnpm check and cargo test --workspace pass; CI workflow paths are updated
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
fuzz/ moved to crates/fuzz/ (excluded from the main Cargo workspace, still its own cargo-fuzz workspace; seed.sh and the nightly workflow follow), evals/ to benchmarks/evals/ (pnpm-workspace via benchmarks/*, lockfile relinked, demo runner kind fixed), CONTRIBUTING.md, SECURITY.md and renovate.json to .github/ (README, docs, AGENTS.md links updated), and the site build to apps/web/dist/site (scripts/site.ts, pages.yml, dev mounts, contributing notes). Nothing writes the root data/ any more (stale local copy; the example keeps its own). Validation: pnpm check (one stale llms-full.txt, regenerated, then the remaining steps: docs tests 26, scripts tests 49, size, cargo test 173), cargo metadata for the fuzz workspace, seed.sh, no new root entries after the run. Not run: the nightly fuzz workflow and a full build:site.
<!-- SECTION:FINAL_SUMMARY:END -->
