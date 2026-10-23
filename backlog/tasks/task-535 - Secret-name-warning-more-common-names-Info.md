---
id: TASK-535
title: 'Secret-name warning: more common names (Info)'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-23 18:09'
updated_date: '2026-10-23 19:16'
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
- [x] #1 Those names warn, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (0.6.1 cleanup, worker for Lux): claimed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The dev-only warning for secret-looking FormData names now also catches private keys (privateKey, private_key), plural passwords, ssn, iban and session ids (sessionId, session-id, sessionIds). ssn and iban must stand alone (classname stays quiet), as pin already did; session ids stop at the word end (sessionIdle stays quiet). Test in packages/lumiose/src/server/serialize.test.ts; docs/concepts/data-and-actions.md lists the new names. Validation: serialize tests, oxlint, oxfmt, docs:check.
<!-- SECTION:FINAL_SUMMARY:END -->
