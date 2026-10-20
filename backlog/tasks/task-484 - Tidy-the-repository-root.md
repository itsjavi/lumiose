---
id: TASK-484
title: Tidy the repository root
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:22'
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
- [ ] #1 The root holds only .github, apps, backlog, benchmarks, crates, examples, packages, scripts and root config files
- [ ] #2 A build, test and website build leave no new folders at the root
- [ ] #3 pnpm check and cargo test --workspace pass; CI workflow paths are updated
<!-- AC:END -->
