---
id: TASK-487
title: Extract gbapu into itsjavi/gbapu and publish it to npm
status: To Do
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
labels: []
milestone: m-13
dependencies: []
priority: medium
ordinal: 483000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73: a public MIT repository with the engine's TypeScript source from the crystal-exporter tool of the pokemon-time-crystal project, fresh history, tests, types and a build, published to npm as gbapu. The create-lumiose agent setup does not apply (no Lumiose code); it gets AGENTS.md, CLAUDE.md, README, LICENSE, oxlint, oxfmt, Vitest, CI and Renovate. Ask the user before creating the repository and before publishing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user approved creating the repository and publishing
- [ ] #2 github.com/itsjavi/gbapu exists, MIT, with source, tests and CI
- [ ] #3 gbapu is on npm and its types resolve
<!-- AC:END -->
