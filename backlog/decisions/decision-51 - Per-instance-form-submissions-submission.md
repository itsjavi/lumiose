---
id: decision-51
title: 'Per-instance form submissions: submission()'
date: '2026-10-15 03:14'
status: accepted
---
## Context

`submit()` posts to a page action without navigating, but its state is page-wide: `isSubmitting(name)` is keyed by action name and `actionData()` holds the page's last result. Rows of a list that submit the same action shared one pending flag and overwrote each other's results, which React Router's `useFetcher` keeps per instance. Proposal: doc-8, feature 4 (TASK-293).

## Decision

User decision, 2026-10-15.

- `submission<typeof actions.name>()` from `lumiose`, coined after Solid Router's `useSubmission` without `use` (decision-35), created during component setup.
- Members: `submit(target, options?)` (what `submit()` takes, returning the same promise), `isSubmitting()`, `result()` (the last settled `{ type: "success" | "failure", status, data }`, typed from the action, `undefined` before), `error()` (the last unexpected `FetchError`), `abort()` and `reset()`.
- A new submission on the same handle aborts the previous one; disposing the component aborts too.
- A handle does not set `actionData()`; `isSubmitting(name)` still counts it. SPA invalidation and `optimistic()` work as with `submit()`.
- Rejected: React Router's name `fetcher()` (its fetchers also load data), a minimal member set, and TanStack's `isPending`/`data` names.

## Consequences

- `submit()` gains an internal option to leave `actionData()` alone; `submit()`, `isSubmitting()` and `actionData()` are otherwise unchanged.
- Implemented in TASK-297. The handle's type is `Submission` (Solid Router's name), confirmed by the user on 2026-10-15.
