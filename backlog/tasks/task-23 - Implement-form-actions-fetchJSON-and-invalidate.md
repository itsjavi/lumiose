---
id: TASK-23
title: 'Implement form actions, fetchJSON and invalidate'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:31'
labels: []
milestone: m-3
dependencies:
  - TASK-22
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mutations go through form actions that work without JS and can be enhanced from islands, and reads from SPA/islands use an isomorphic fetchJSON (decision-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 action/actions with ?/name, formData, fail(), actionData(), Origin/CSRF check on by default
- [ ] #2 submit(), pending() and invalidate() client helpers; fetchJSON is served in-process during SSR
- [ ] #3 Tests for no-JS and enhanced flows
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared protocol module (app/actions/protocol.ts): fail()/ActionFailure, ActionResult union, x-lumen-action header, ?/name parsing.
2. Server: page POST dispatch in handler.ts -> app/server/actions.ts (resolve action/actions[name], ctx.formData() cached, 404 unknown named action, 405 when no actions; Allow lists POST). Results: Response/redirect (303), data -> re-render 200 with actionData(), fail -> re-render with status. JSON mode (Accept: application/json + x-lumen-action) -> {type,status,data|location|error} with encodeData; 3xx after middleware converted to redirect results.
3. Origin/CSRF check (app/server/csrf.ts), Go CrossOriginProtection-style: Sec-Fetch-Site then Origin host, for unsafe methods with CORS-simple content types; csrf option {allowedOrigins} or false.
4. actionData(): server reads request scope; action data embedded as JSON script so islands hydrate consistently; browser signal initialised from it and set by submit().
5. Client: submit(form|event|FormData|record, {action, method, signal}), submitting(name?), invalidate(), injectable navigation hooks for the SPA router (TASK-25).
6. fetchJSON + FetchError (HttpError subclass): browser = fetch; server = same-origin requests dispatched in-process through the handler (shared cookie jar, locals copy, depth guard).
7. Tests (handler actions, csrf, JSON protocol, submit in happy-dom, fetchJSON in-process + client), typecheck/lint/test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (session nova-task23-20261008T133112Z): claimed, In Progress.
<!-- SECTION:NOTES:END -->
