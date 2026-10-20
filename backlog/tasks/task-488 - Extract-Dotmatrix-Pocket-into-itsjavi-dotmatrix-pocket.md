---
id: TASK-488
title: Extract Dotmatrix Pocket into itsjavi/dotmatrix-pocket
status: To Do
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
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
decision-73: examples/spa-dotmatrix with its history, as a small pnpm workspace (the Lumiose app now, ports/react later), depending on lumiose 0.5.0+ and gbapu from npm. Setup: what npm create lumiose writes (AGENTS.md, Lumiose skill), CLAUDE.md pointing to AGENTS.md, README pointing to the Lumiose backlog for old TASK ids, MIT LICENSE, oxlint, oxfmt, Vitest, Playwright, a CI workflow that checks and deploys to GitHub Pages, and Renovate. Ask the user before creating the repository.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user approved creating the repository
- [ ] #2 github.com/itsjavi/dotmatrix-pocket exists, public, with the history of examples/spa-dotmatrix
- [ ] #3 CI passes and the app is live on GitHub Pages
<!-- AC:END -->
