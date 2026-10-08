---
id: TASK-29
title: Implement the language server
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:26'
labels: []
milestone: m-4
dependencies:
  - TASK-27
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Editors need full TS 7 features in .stsx plus CSS features in style blocks, without TS plugins (decision-6, spec §9.2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Takeover proxy in front of one TS 7 native LSP for .ts/.tsx/.stsx: masked buffers, shadow URI rewriting in every request, response and workspace edit
- [ ] #2 CSS language service on style blocks with $refs replaced by same-length identifiers
- [ ] #3 Class completion from in-scope styles, go-to-definition and rename between classes and selectors, $ref hovers, compiler diagnostics; tests
<!-- AC:END -->
