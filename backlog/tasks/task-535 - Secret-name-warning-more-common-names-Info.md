---
id: TASK-535
title: 'Secret-name warning: more common names (Info)'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-23 18:09'
labels:
  - security
dependencies: []
priority: low
ordinal: 528000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: packages/lumiose/src/server/serialize.ts still misses privateKey, passwords, ssn, iban and sessionId in its dev-only warning for secret-looking FormData names.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Those names warn, with a test
<!-- AC:END -->
