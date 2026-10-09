---
id: TASK-131
title: >-
  create-lumen --mcp and lumen agents init --mcp for Claude Code and Codex
  (decision-26 §5)
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:26'
labels:
  - create
  - mcp
  - agents
dependencies: []
priority: low
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §5. Verify Codex's current project-level MCP config support from its official docs before choosing the file; otherwise print the codex mcp add command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 --mcp writes .mcp.json (Claude Code) and the Codex config (or prints the command), using the project's package-manager runner; tests; docs (reference/mcp.md, create docs)
<!-- AC:END -->
