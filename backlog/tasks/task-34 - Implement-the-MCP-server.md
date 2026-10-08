---
id: TASK-34
title: Implement the MCP server
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 21:58'
labels: []
milestone: m-5
dependencies:
  - TASK-28
  - TASK-32
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents work best with direct, structured access to docs, diagnostics and project structure (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen mcp exposes docs_search, docs_get, check, routes, components, compile, render, dev_logs
- [ ] #2 Tested with an MCP client
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (checkpoint): claimed and released before any work; nothing changed. Next: add @modelcontextprotocol/sdk to packages/lumen (not installed yet), implement lumen mcp in packages/lumen/src/cli/mcp/ reusing docs/index.ts (loadDocs, resolveTopic, searchDocs), check(), listRoutes() (cli/routes.ts), compile via @lumen/compiler, render via createDevServer; register 'mcp' in cli/main.ts COMMANDS; Vitest with the SDK client.
<!-- SECTION:NOTES:END -->
