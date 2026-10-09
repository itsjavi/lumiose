---
id: TASK-168
title: >-
  Security: block unsafe URL attributes; sanitize ErrorBoundary errors in
  production SSR (decision-29)
status: To Do
assignee:
  - Spark
created_date: '2026-10-09 12:10'
labels:
  - security
  - dom
  - server
milestone: m-7
dependencies: []
priority: high
ordinal: 168000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-29 (user-approved): dynamic href/src/action/formaction/xlink:href/poster/data values with javascript:/vbscript:/data:text/html schemes render a harmless placeholder in production with a LUM dev warning (new code + errors page), static literals untouched — client attribute writers and server attrs (server/attrs.ts, Nova's area, authorised) with parity; ErrorBoundary fallbacks get a generic error + digest during server rendering in production (server/components.ts authorised), full error logged with the digest, dev unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 URL sanitization on client and server with parity tests, tolerant of whitespace/case/entity tricks; new LUM diagnostic documented
- [ ] #2 ErrorBoundary production SSR sanitization with digest logging; tests; security.md and the ErrorBoundary docs updated
<!-- AC:END -->
