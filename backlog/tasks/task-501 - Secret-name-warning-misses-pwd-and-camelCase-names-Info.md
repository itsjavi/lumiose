---
id: TASK-501
title: Secret-name warning misses pwd and camelCase names (Info)
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: low
ordinal: 497000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding S4: packages/lumiose/src/server/serialize.ts:29, the development warning for secret-looking FormData names misses pwd and camelCase such as passwordConfirm. Widen the heuristic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 pwd, passwordConfirm and newPassword warn; a test covers them
<!-- AC:END -->
