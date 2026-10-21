---
id: TASK-518
title: >-
  Agent guidance: teach ?client for small scripts in the managed AGENTS.md block
  and the lumiose skill
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-21 07:09'
labels:
  - docs
  - dx
milestone: m-13
dependencies: []
priority: medium
ordinal: 512000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the itsjavi.com port (TASK-486). lumiose agents init 0.5.0 still writes "Only islands ship JS in static/server pages" (packages/cli/src/agents/index.ts), and the lumiose skill does not mention ?client, so an agent following them makes an island (and ships the runtime) for a theme toggle or a copy button. decision-71 makes ?client the way for small scripts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The managed AGENTS.md block says small scripts of server-rendered components go through ?client custom elements with typed attributes, and islands are for reactive UI
- [ ] #2 The lumiose skill says the same and links the docs section
<!-- AC:END -->
