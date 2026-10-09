---
id: TASK-171
title: 'Security: MCP render SSRF and file containment (TASK-162)'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 12:10'
labels:
  - security
  - mcp
milestone: m-7
dependencies: []
priority: medium
ordinal: 171000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prism TASK-162: M3 the MCP render tool resolves path with new URL(path, server.url) (cli/mcp/dev.ts:85), so absolute or //host paths fetch other origins with arbitrary headers; L6 compile/components read files outside the root (cli/mcp/source.ts:39) and tool results return untrusted content verbatim.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 render accepts only single-leading-slash paths and asserts the dev server origin; compile/components enforce realpath containment in the project root; tool descriptions/INSTRUCTIONS mark returned content as untrusted data; tests
<!-- AC:END -->
