---
id: TASK-166
title: 'Security fixes (client): navigation scheme allowlist, spread on* parity'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 12:01'
updated_date: '2026-10-09 12:03'
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
- [x] #1 Client navigate/action-redirect paths accept only http(s) or relative URLs after resolving against document.baseURI and throw otherwise; tests
- [x] #2 Client spread drops /^on/i attributes; parity.test.ts in sync with the server
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: navigationUrl() (app/actions/navigation.ts) resolves against document.baseURI and throws a TypeError unless http:/https:; used by the MPA default navigate (location.assign), so enhanced action redirects reject submit(), and by lumen/router navigate() (which also carries thrown redirect() from SPA pages). router.ts:522 (stale-chunk reload) and setSearch only navigate to URLs the router already resolved/owns. Client spread drops /^on/i keys that are not handlers (onX functions and on:x stay events). Tests: client.test.ts (navigationUrl, MPA default, submit rejects on a javascript: redirect), router.test.ts (navigate javascript: throws), component.test.ts (spread drops onclick/ONMOUSEOVER). parity.test.ts not changed: server/attrs.ts still emits lowercase on* until Nova's TASK-165 lands; Nova should add an onclick case to the spread parity props then. Docs: router.md navigate, app.md submit, security.md 'Client navigation'.
<!-- SECTION:NOTES:END -->
