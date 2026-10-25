---
id: TASK-590
title: applyScope skips invalid scope tokens as the server does (hardening)
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-25 03:02'
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
- [ ] #1 A malformed $$scope token is skipped on the client as on the server, without throwing; a test covers both renderers
<!-- AC:END -->
