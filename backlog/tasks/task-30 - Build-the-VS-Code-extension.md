---
id: TASK-30
title: Build the VS Code extension
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:04'
labels: []
milestone: m-4
dependencies:
  - TASK-29
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
VS Code is the primary editor target: it needs the stsx language, a grammar, the LSP client and takeover setup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 stsx language with TSX + embedded CSS grammar and $ref highlighting; LSP client; snippets; a prompt that offers takeover mode
- [ ] #2 Packaged .vsix built locally and verified in VS Code on a sample file
<!-- AC:END -->
