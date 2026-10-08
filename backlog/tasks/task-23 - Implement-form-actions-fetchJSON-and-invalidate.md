---
id: TASK-23
title: 'Implement form actions, fetchJSON and invalidate'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:43'
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
- [x] #1 action/actions with ?/name, formData, fail(), actionData(), Origin/CSRF check on by default
- [x] #2 submit(), pending() and invalidate() client helpers; fetchJSON is served in-process during SSR
- [x] #3 Tests for no-JS and enhanced flows
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

Implementation (Nova):
- Shared protocol: packages/lumen/src/app/actions/protocol.ts (fail()/ActionFailure, ActionResult, ACTION_HEADER = x-lumen-action, ?/name parsing).
- Server: app/server/actions.ts (resolve/run actions, ctx.formData() cached, 400 for non-form bodies, JSON results with encodeData), app/server/csrf.ts (Go CrossOriginProtection-style: Sec-Fetch-Site, else Origin host vs request host; allowedOrigins; csrf: false), handler.ts (page POST dispatch, 404 missing action, 405 + Allow when no actions, re-render with actionData()/fail status, embedded <script type=application/json data-l-action> so islands hydrate with the same actionData(), 3xx -> redirect results for enhanced requests, in-process fetch with shared cookie jar, locals copy, abort link, depth limit 8).
- Client: app/actions/client.ts (submit, submitting, actionData, invalidate, setClientNavigation hook for TASK-25); node-entry stubs in app/actions/server.ts.
- fetchJSON: app/fetch-json.ts (FetchError extends HttpError with url/data; browser fetchJSON), app/server/fetch-json.ts (in-process same-origin dispatch during SSR, follows same-origin redirects).
- DX decision for Lux/user: in-flight state is exposed as submitting(name?) (parallels router navigating(); core pending() stays the async-component flag from TASK-17); submit() resolves success/failure/redirect and rejects with FetchError for error results.
- Validation: pnpm test 441/441 passing (46 new: actions.test.ts 20, fetch-json.test.ts 9, actions/client.test.ts 16, public-api +1); lumen typecheck clean for app/server (only error is Spark's in-progress src/core/async.ts, TASK-17); language-server typecheck fails on Beacon's untracked package (TASK-29); pnpm lint 0 errors (pre-existing router placeholder warning).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Form actions, fetchJSON and invalidate (decision-18, spec §8).
Server: pages export action(ctx) or actions = { name(ctx) }; POST runs it (?/name for named; 404 for a missing action, 405 + Allow when the page has none). ctx.formData() is cached (400 if not a form). Results: Response/redirect() (303 after POST); data -> page re-renders 200 with actionData(); fail(status, data) -> re-render with that status. Origin check on by default (Sec-Fetch-Site, else Origin host; csrf: { allowedOrigins } or false), 403 otherwise; applies to page POSTs and form-encoded endpoint requests.
Enhancement protocol: Accept: application/json + x-lumen-action: 1 -> JSON { type: success|failure|redirect|error, status, data? | location | error.message }, data encoded with encodeData; redirects (also middleware 3xx) travel as HTTP 200 redirect results; the header is echoed.
Client: submit(form | submitEvent | FormData | URLSearchParams | record, { action?, method?, signal? }) -> ActionResult (rejects FetchError on error results); submitting(name?) and actionData() signals (actionData starts from server-embedded data after a no-JS post); invalidate() (MPA reload); setClientNavigation() hook for the SPA router.
fetchJSON<T>(url, init?): FetchError (an HttpError with url/data) on non-2xx; during SSR same-origin URLs are served in-process (shared cookie jar, cookie/authorization forwarded, locals copy, abort link, redirect following, depth limit).
Tests: 46 new (441 total passing). Open: submitting() naming is a DX decision for Lux/user (spec §8 says pending()); static pages with actions need a build rule (TASK-26 note); SPA hooks (TASK-25 note).
<!-- SECTION:FINAL_SUMMARY:END -->
