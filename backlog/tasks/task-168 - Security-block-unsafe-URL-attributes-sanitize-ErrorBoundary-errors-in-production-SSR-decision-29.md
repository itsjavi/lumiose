---
id: TASK-168
title: >-
  Security: block unsafe URL attributes; sanitize ErrorBoundary errors in
  production SSR (decision-29)
status: Done
assignee:
  - Spark
created_date: '2026-10-09 12:10'
updated_date: '2026-10-09 12:24'
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
- [x] #1 URL sanitization on client and server with parity tests, tolerant of whitespace/case/entity tricks; new LUM diagnostic documented
- [x] #2 ErrorBoundary production SSR sanitization with digest logging; tests; security.md and the ErrorBoundary docs updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: (1) dom/url.ts (shared by lumen/dom setAttr — so spread too — and lumen/server attr/spreadAttrs): dynamic values of href/src/action/formaction/xlink:href/poster/data/cite/background whose scheme, after stripping leading C0/space and tabs/newlines anywhere (case-insensitive), is javascript:/vbscript:/data:text/html become about:blank#blocked, with a LUM4009 console warning in dev (blocked in dev too). Static literals never reach these writers. Entities stay literal (server escapes &). New LUM4009 (registry.rs line, Photon FYI) with docs/errors/LUM4009.md. Parity: server/parity.test.ts 'unsafe URL parity' (8 unsafe incl. case/C0/tab/newline/data mime tricks, 7 safe incl. &#106; entities) for 7 attributes plus spread. (2) Production SSR ErrorBoundary: RenderToStreamOptions.sanitizeErrors (handler passes it when !dev; prerender too): fallbacks get Error('An error occurred while rendering this part of the page (digest xxxxxxxx).') with .digest, and the original error (digest property added) goes to onError. HttpErrors and dev unchanged; client boundaries unchanged. Tests: render.test.ts, server-renderer.test.ts (streamed boundary). Docs: security.md (Unsafe URLs, Error details), reference/components.md ErrorBoundary. Size: every export 9.97 kB brotli (hard cap 10.00; +0.13 kB from the URL check) — near the cap, see TASK-173.

Nova 2026-10-09 (TASK-165): changed server/attrs.ts NOT_ATTRIBUTE to /^on|^(?:bind|client):/i so spread props drop lowercase on* keys like the client (parity test in server/parity.test.ts). Nothing else in your files.
<!-- SECTION:NOTES:END -->
