---
id: TASK-119
title: 'Check-time LUM4002: island props must be serialisable'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:20'
labels:
  - tooling
  - types
dependencies: []
priority: medium
ordinal: 119000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 5. <Counter client:load onDone={() => …} /> passes lumen check and lumen build and fails with a 500 at request time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen check / LSP report LUM4002 for client:* call-site props whose type is not serialisable (functions, class instances, symbols…), via the shadow TSX types or a compiler check
- [ ] #2 Tests; errors/LUM4002.md describes the check-time behaviour
<!-- AC:END -->
