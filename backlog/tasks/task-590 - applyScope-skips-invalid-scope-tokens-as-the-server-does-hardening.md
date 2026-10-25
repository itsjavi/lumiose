---
id: TASK-590
title: applyScope skips invalid scope tokens as the server does (hardening)
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-25 03:02'
updated_date: '2026-10-25 03:14'
labels:
  - security
  - hardening
dependencies: []
priority: low
ordinal: 582000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.8.0 delta security review, hardening (not exploitable). The server writes `$$scope` attribute tokens only when they are valid attribute names (packages/lumiose/src/server/attrs.ts, ATTRIBUTE_NAME) and `.name` class tokens only when non-empty. The client's applyScope (packages/lumiose/src/dom/attributes.ts:197-210) calls setAttribute and classList.add on every token, so a malformed token throws (InvalidCharacterError, or SyntaxError for `.`) and stops the render. The compiler never emits such tokens; one reaches applyScope only when an app spreads an untrusted object into a component's props (`<Card {...data} />`) and the call site has no scope of its own. Such a spread can already set any prop, so this adds no capability: it is a crash where the server skips the token.

Fix: skip invalid tokens on the client as the server does, with a test for both renderers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A malformed $$scope token is skipped on the client as on the server, without throwing; a test covers both renderers
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux, solo takeover before 0.8.0): new packages/lumiose/src/dom/scope.ts with the token forms the compiler writes, data-<namespace>-<hash> and .<namespace>-<hash> (isScopeAttribute, isScopeClass). The client's applyScope and the server's scopeClasses and spreadAttrs use them, so both skip any other token (and applyScope ignores a value that is not a string). Test in src/server/parity.test.ts: a spread with malformed tokens (., whitespace, uppercase, on*, quotes, <b>, a digit first) renders the same DOM on both sides without throwing (InvalidCharacterError before the fix), and non-string values set nothing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Client and server apply only the scope tokens the compiler writes (data-<namespace>-<hash>, .<namespace>-<hash>) and skip the rest alike; the client no longer throws on a malformed token. Tested in the client/server parity test.
<!-- SECTION:FINAL_SUMMARY:END -->
