---
id: TASK-490
title: Remove the extracted apps and redirect their showcase URLs
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-20 21:23'
labels: []
milestone: m-13
dependencies:
  - TASK-488
  - TASK-489
priority: medium
ordinal: 486000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73: delete examples/spa-dotmatrix and examples/spa-chiptune, point the showcase at the new repositories and their Pages, redirect /showcase/dotmatrix/ and /showcase/chiptune-tracker/ to the new pages, and update the demo script and its tests, README, CONTRIBUTING, AGENTS.md, agents.json (Chime) and the launch configuration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both examples are gone and nothing in the repository references them
- [ ] #2 The old showcase URLs redirect to the new pages in the built site
- [ ] #3 pnpm check passes
<!-- AC:END -->
