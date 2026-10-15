---
id: TASK-297
title: Per-instance form submissions
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:36'
labels:
  - actions
milestone: m-10
dependencies:
  - TASK-293
priority: medium
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`submit()` posts to a page action without navigating, but its state is page-wide: `isSubmitting(name?)` is keyed by action name and `actionData()` holds the page's last result. Two rows of a list that submit the same named action share one pending flag and overwrite each other's data; React Router's useFetcher keeps that state per instance.

Approved shape (decision-51): `submission<typeof actions.name>()` from `lumiose`, created during component setup, with `submit(target, options?)`, `isSubmitting()`, `result()` (the typed `{ type, status, data }`), `error()`, `abort()` and `reset()`. A new submission on the same handle aborts the previous one, and disposing the component aborts. A handle leaves `actionData()` alone (through an internal `submit()` option) while `isSubmitting(name)` still counts it; SPA invalidation and `optimistic()` work as with `submit()`.

Code: packages/lumiose/src/app/actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Two instances submitting the same action track pending state, data and failures independently
- [x] #2 Types come from typeof actions, like submit<typeof actions.name>()
- [x] #3 Abort cancels the request and leaves the instance idle, and a newer submission supersedes an older one on the same instance
- [x] #4 SPA invalidation and optimistic() work with it
- [x] #5 Tests cover islands and SPA pages, success, fail(), redirect, abort and concurrency
- [x] #6 concepts/data-and-actions.md, reference/app.md and the Coming from guides are updated
- [x] #7 A handle leaves actionData() unchanged while isSubmitting(name) still counts it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15), batch 2, implementation (packages/lumiose/src/app/actions):
- `submission<typeof actions.x>()` (client.ts): signals for pending, result and error, and an AbortController per submission. `submit()` aborts the handle's previous submission, combines its signal with `options.signal`, and calls the internal `post(target, options, pageData)` that `submit()` now wraps (`pageData: false` leaves `actionData()` alone, decision-51); `isSubmitting(name)` still counts it (same in-flight list). Only the latest submission settles the handle; `abort()` makes it idle at once; `onCleanup(abort)` aborts on disposal.
- Settling: success/failure set `result()` and clear `error()`; a `FetchError` sets `error()`; an `AbortError` (supersession, abort(), options.signal) changes nothing; a redirect navigates and leaves `result()`. The returned promise is `submit()`'s own (rejects for errors and aborts) but has a handler attached, so `onSubmit={handle.submit}` reports no unhandled rejection; other errors (a form that does not post) are re-thrown so they still surface.
- Server (server.ts): an idle handle whose `submit()` rejects, as `submit()` does.
- Names chosen (for review): the type `Submission<Data, Failure>` (Solid Router's name for useSubmission's value), exported from lumiose; `SubmissionResult` stays internal.
- Tests: client.test.ts (two instances on one action: pending, results, failures, actionData untouched, isSubmitting(name); supersession and abort with the request signal aborted; disposal aborts; error() without unhandled rejection and reset(); redirect; SPA invalidation vs MPA; optimistic() rollback on fail(); enhanced submit event; end to end against the request handler), server.test.ts (idle stub), types.test.ts (types from typeof actions.x).
- Docs: concepts/data-and-actions.md (Per-instance submissions, API row, checked example, mistake), reference/app.md (### submission), Coming from: react.md (useActionState per form), react-router.md (useFetcher per instance, useFetchers), solid.md (useSubmission, useSubmissions).
- Checks: vitest packages/lumiose 1016 passed, typecheck clean, oxlint clean on touched files, docs:check and docs tests green, size caps OK (submission() is tree-shaken from apps that do not use it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
submission<typeof actions.name>() gives a component its own submit, isSubmitting(), result(), error(), abort() and reset(): instances posting the same action keep their state apart, a newer submission or disposal aborts the one in flight, actionData() is left alone while isSubmitting(name) still counts it, and SPA invalidation and optimistic() work as with submit().
<!-- SECTION:FINAL_SUMMARY:END -->
