---
id: TASK-488
title: Extract both chiptune apps into itsjavi/dotmatrix
status: To Do
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-20 23:42'
labels: []
milestone: m-13
dependencies:
  - TASK-485
  - TASK-487
priority: medium
ordinal: 484000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73 (revised 2026-10-21): one public MIT repository, a pnpm workspace with apps/pocket (examples/spa-dotmatrix, Dotmatrix Pocket) and apps/advanced (examples/spa-chiptune, formerly Lumiose Chip), keeping both histories (git filter-repo of both paths, moved to their app folders); apps/pocket-react comes with TASK-491. Depends on lumiose 0.5.0+ and gbapu from npm. Setup: what npm create lumiose writes (AGENTS.md, Lumiose skill), CLAUDE.md pointing to AGENTS.md, README pointing to the Lumiose backlog for old TASK ids, MIT LICENSE, oxlint, oxfmt, Vitest, Playwright, a CI workflow and Renovate. Ask the user before creating the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user approved creating the repository
- [ ] #2 github.com/itsjavi/dotmatrix exists, public, with apps/pocket and apps/advanced and the history of both examples
- [ ] #3 CI passes for both apps
<!-- AC:END -->
