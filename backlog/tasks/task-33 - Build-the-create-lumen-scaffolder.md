---
id: TASK-33
title: Build the create-lumen scaffolder
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:42'
labels: []
milestone: m-5
dependencies:
  - TASK-28
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A new project must start agent-ready: AGENTS.md, CLAUDE.md, a skill and a working tsconfig.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 create-lumen offers templates (minimal, ssr, spa, static) that run out of the box
- [ ] #2 Generated AGENTS.md (with the .stsx hint and local-docs pointer), a CLAUDE.md referencing it, and a skill bundle; lumen agents init does the same for existing projects
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (decision-21): create-lumen templates set lumen({ mode }) explicitly (spa / ssr / static).
<!-- SECTION:NOTES:END -->
