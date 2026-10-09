---
id: decision-20
title: >-
  In-flight state API: pending, submitting, navigating and busy; submit returns
  failures
date: '2026-10-08 13:47'
status: accepted
---
## Context

Several features have their own "something is in flight" state:
- async components re-running (decision-13);
- form submissions (decision-18);
- SPA navigations (spec §7.5).

The user wanted specific names, plus one summary state, so that UI like a global progress bar doesn't need if/else chains. They chose the names and the `submit()` failure semantics on 2026-10-08.

## Decision

**State helpers** (all are signals)
- `pending()`: inside an async component, true while that component's own re-run is in flight.
- `submitting(name?)`: true while a form action submission is in flight. Pass the named action to narrow it.
- `navigating()`: true while an SPA router navigation is in flight.
- `busy()`: the app-wide summary. It is true while any of the above is in flight, and also while any `<Suspense>` boundary is showing its fallback for pending content.

**`submit()` results**
- An action's `fail(status, data)` resolves to `{ type: "failure", status, data }`.
- Success resolves to `{ type: "success", status, data }`.
- Redirects are followed.
- Only unexpected errors (`type: "error"`, network failures) reject, with `FetchError`.

## Consequences

- The core needs an app-wide in-flight registry, which `busy()` reads. Async components, Suspense, `submit()` and the router register with it.
- Spec §4.3, §7.5 and §8 now use these names. TASK-23's `submitting()` and `submit()` already follow them.

_Amended 2026-10-09 (user): after a successful `submit()`, Lumen automatically runs `invalidate()` for the current page. Its async components re-run, and the stale UI stays visible until the new data arrives. To opt out, pass `submit(form, { invalidate: false })`._

_Amended 2026-10-09 (Lux, delegated by the user: "whatever causes less problems later and less complexity"): on MPA pages, `invalidate()` reloads the page, so a successful `submit()` reloads it too, like a native form's post/redirect/get. The reload re-renders every server part from fresh data, which partial island refreshes could not do without leaving server-rendered content stale, and it needs no extra runtime code. The success value of `actionData()` is not kept across the reload; failures never reload. Islands that need to keep local state or show the success data pass `{ invalidate: false }`._
