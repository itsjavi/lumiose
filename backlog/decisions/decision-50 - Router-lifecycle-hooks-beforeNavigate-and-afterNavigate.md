---
id: decision-50
title: 'Router lifecycle hooks: beforeNavigate and afterNavigate'
date: '2026-10-15 03:14'
status: accepted
---
## Context

`lumiose/router` could navigate and report state, but nothing ran around a navigation: no way to confirm leaving unsaved changes, cancel a navigation, count a page view or move focus afterwards. Proposal: doc-8, feature 3 (TASK-293).

## Decision

User decision, 2026-10-15. SvelteKit's names and semantics (decision-32):

- `beforeNavigate(fn)` and `afterNavigate(fn)` from `lumiose/router`, called during component setup and removed when the component is disposed.
- The navigation object is `{ type, from, to, willUnload, cancel() }`; `from` and `to` are `{ url, route, params }`, and `to` is `null` when the next document is outside the app. `type` is `"link"`, `"navigate"` (`navigate()` and `searchParams.set()`), `"popstate"`, `"leave"` (another document or closing the tab), or `"enter"` for `afterNavigate` only.
- `beforeNavigate` runs before the router loads the next page; `cancel()` stops it. For back/forward the router cancels where the browser allows it and otherwise returns to the entry it left. For `"leave"`, `cancel()` makes the browser show its own `beforeunload` prompt.
- `afterNavigate` runs after the swap, scroll restoration and focus reset (after a View Transition's DOM update), and once with `"enter"` when the component mounts.
- In islands on MPA pages, `beforeNavigate` sees only `"leave"` and `afterNavigate` fires once with `"enter"`; no router code loads for them.
- Rejected: `onBeforeNavigate`/`onAfterNavigate` (coined), a React Router-style `blocker()` handle, and global guards (app-wide observation is decision-49's `navigate` wrapper).

## Consequences

- The History fallback starts storing an entry index in `history.state` (it stores only a scroll key today), so a cancelled back/forward can return.
- A `retry()` on cancelled navigations, for async custom dialogs, can be added later if needed.
- Implemented in TASK-296.
