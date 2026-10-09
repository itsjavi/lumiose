---
id: TASK-166
title: 'Security fixes (client): navigation scheme allowlist, spread on* parity'
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 12:01'
labels:
  - security
  - dom
  - router
milestone: m-7
dependencies: []
priority: medium
ordinal: 166000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-162 (Prism): M2 an enhanced action's redirect() location goes to navigation.navigate → location.assign (actions/client.ts:132, actions/navigation.ts:18; router.ts:522, 620-622), so a javascript: URL runs script in the app origin; L1 client spread must drop lowercase on* attributes like the server (Nova's task).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Client navigate/action-redirect paths accept only http(s) or relative URLs after resolving against document.baseURI and throw otherwise; tests
- [ ] #2 Client spread drops /^on/i attributes; parity.test.ts in sync with the server
<!-- AC:END -->
