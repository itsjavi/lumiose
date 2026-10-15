---
id: TASK-299
title: 'Client instrumentation for navigations, submissions and fetches'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:56'
labels:
  - observability
milestone: m-10
dependencies:
  - TASK-293
  - TASK-295
priority: low
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing reports what happens in the browser: SPA navigations, `submit()` calls, `fetchJSON` and `query` requests, island hydration, and uncaught errors in islands. React Router instruments its client router; Lumiose apps have to patch these by hand.

Approved shape (decision-49): `src/instrumentation.client.ts` exports `onError(error, info)` for island errors (`"hydrate"`, `"render"`, `"effect"`), router errors (`"navigate"`) and `submit()` rejections (`"submit"`), and `instrumentations`: observers wrapping `navigate`, `submit`, `fetch` (`fetchJSON` and `query`) and `hydrate` (each island), with the server's observer rules. Exports that do not exist cost nothing: the build drops the dispatch code. TASK-305 makes island load failures reportable first.

Code: packages/lumiose/src/app/router, packages/lumiose/src/dom, and packages/lumiose/src/app/actions (Nova's area: coordinate with Nova).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigations, submissions, fetchJSON and query requests and island hydration can be wrapped, with route and timing
- [x] #2 Uncaught errors in islands and the router reach the hook
- [x] #3 Apps that register no hooks ship no extra runtime bytes (size checks)
- [x] #4 Tests cover each phase
- [x] #5 The docs and the Coming from guides are updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark started 2026-10-15 (batch 3).

Implementation (Spark, batch 3):
- Dispatch: packages/lumiose/src/dom/instrument.ts. setClientInstrumentation(exports) validates onError and instrumentations (malformed ones are logged and skipped); instrument(phase, info, work) runs a phase inside its wrappers with Nova's observe() (app/server/instrumentation.ts), so the rules are the server's; notify(error, phase, island, route) calls onError (what it throws is logged). awaitClientInstrumentation(entry) makes phases that start before the client entry ran (the first islands, the SPA root) wait for its hooks, so the first hydration is observed.
- Zero cost when unused: every call site is guarded by INSTRUMENTED = !!import.meta.env.LUMIOSE_CLIENT_HOOKS. lumiose build defines it (client environment) only when src/instrumentation.client.ts exists; lumiose dev defines it always (top-level define: dev's import.meta.env ignores per-environment defines), so creating the file needs no restart. Verified: with the flag off, every-export, islands, router, actions and fetch/query bundles are byte-identical in length to HEAD (only mangled names differ in the router); build.test.ts asserts the dispatch ships with the file and not without; size.ts reports the instrumented cost: 0.68 kB brotli on top of islands, router, actions and fetchJSON/query (doc-8 estimated 0.3-0.5 kB).
- Phases: hydrate (dom/islands.ts: loading + hydrating each island, info { island }); navigate (router.ts visit(): until on screen, info { type, from, to }, both the Navigation API and the History fallback); submit (actions/client.ts post(): info { action, url }; re-enters post once inside the wrappers to avoid a second function in uninstrumented builds); fetch (fetchJSON: each real request { url }; query: each call of fn { key }; cache hits are not requests). Every info has route (the SPA route, undefined on MPA pages; new currentRoute() in app/router/hooks.ts).
- onError phases: hydrate (report.ts, TASK-305 path), render (async component errors marked in dom/async.ts, and ErrorBoundary catches in dom/boundaries.ts, with the island ref from owner context), effect (an island's root after it hydrated, dom/hydrate.ts; still rethrown as before), navigate (router fail() with the failing page's route, and a page module that fails to load before the reload), submit (submit()/submission() rejections, not aborts). Default console output is unchanged.
- Public types (approved names): ClientErrorInfo, ClientInstrumentation, exported from lumiose next to Nova's server types (app/public.ts, public.server.ts).
- Edited Nova's area for this task (TASK-299 lists it): app/actions/client.ts, app/fetch-json.ts, app/cache/client.ts, app/client-entry.ts, app/public*.ts, packages/vite/src/app/{project.ts, dev/plugin.ts, production/plugin.ts, production/build.test.ts}. Each edit is a guarded call or a define.
- Tests: src/dom/instrument.test.ts (7: flag, hydrate wrapper and failure, effect and ErrorBoundary errors with island refs, SPA navigations and router errors with routes, submit success/rejection/abort, fetchJSON and query, observer rules and logging); a mutation check on the effect path fails the test. examples/spa-router-e2e: src/instrumentation.client.ts and a throwing /boom page; a spec in Chromium with the Navigation API and with the History fallback, dev and build: hydration of the SPA root, navigations with route and timing, fetchJSON requests, onError for the page that throws. 38/38 e2e pass (the existing specs now also run through TASK-295's gated loader).
- Docs: concepts/islands.md (Errors and tracing section with a checked example, API row), reference/app.md (client instrumentation types), reference/dom.md and reference/router.md pointers, coming-from/nextjs.md (onRouterTransitionStart row, no-equivalent row removed) and coming-from/react-router.md (client instrumentations row moved out of no-equivalent); llms regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/instrumentation.client.ts can export onError (hydrate, render, effect, navigate, submit errors with route and island) and instrumentations (navigate, submit, fetch, hydrate wrappers with the server's observer rules), observed from the first island. A build flag defined only for apps with the file keeps every other app byte-identical; instrumented apps pay about 0.68 kB brotli. Unit tests, a Chromium e2e in both router modes, docs and the Coming-from rows.
<!-- SECTION:FINAL_SUMMARY:END -->
