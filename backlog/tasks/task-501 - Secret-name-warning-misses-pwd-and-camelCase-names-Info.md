---
id: TASK-501
title: Secret-name warning misses pwd and camelCase names (Info)
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-23 08:49'
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
- [x] #1 pwd, passwordConfirm and newPassword warn; a test covers them
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The FormData secret-name warning tests the lowercased name with its camelCase humps split (passwordConfirm as password_confirm) and knows pwd, so pwd, userPwd, passwordConfirm, confirmNewPassword and pinCode warn while passportNumber, spinCount and compassion stay quiet. newPassword already warned (TASK-471 test). Test: serialize.test.ts. Docs: concepts/data-and-actions.md lists pwd and camelCase names.
<!-- SECTION:FINAL_SUMMARY:END -->
