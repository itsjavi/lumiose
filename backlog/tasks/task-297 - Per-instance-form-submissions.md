---
id: TASK-297
title: Per-instance form submissions
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
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

Outcome (shape approved in the design task): a per-instance handle, created in a component, with its own pending state, typed data and failure, submit and abort, keeping `submit()`'s semantics (`fail()` results, redirects, invalidation on SPA pages, `optimistic()`). `submit()`, `isSubmitting()` and `actionData()` keep working.

Code: packages/lumiose/src/app/actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Two instances submitting the same action track pending state, data and failures independently
- [ ] #2 Types come from typeof actions, like submit<typeof actions.name>()
- [ ] #3 Abort cancels the request and leaves the instance idle, and a newer submission supersedes an older one on the same instance
- [ ] #4 SPA invalidation and optimistic() work with it
- [ ] #5 Tests cover islands and SPA pages, success, fail(), redirect, abort and concurrency
- [ ] #6 concepts/data-and-actions.md, reference/app.md and the Coming from guides are updated
<!-- AC:END -->
