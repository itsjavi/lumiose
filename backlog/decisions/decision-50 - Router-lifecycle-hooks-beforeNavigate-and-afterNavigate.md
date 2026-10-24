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
- Implemented in TASK-296. The types `BeforeNavigate`, `AfterNavigate`, `NavigationTarget` and `NavigationType` (SvelteKit's names) were confirmed by the user on 2026-10-15.
- Amendment (TASK-549, 2026-10-24, Spark; confirmed by the user on 2026-10-24, both parts, for 0.7.0). Two refinements, with no change to the API shape:
  - In islands on MPA pages, `beforeNavigate` also sees clicks on same-origin links as `"link"` (`willUnload: true`), through a `click` listener at `window`. Clicks the browser handles itself (modifier keys, `target`, `download`, other origins, fragments) stay `"leave"` or are not navigations. A port needed this to show its own dialog (doc-11).
  - `cancel()` on a `"link"` or `"navigate"` navigation that would load another document now stops it: the click is prevented, or the URL is not loaded, and the page stays. This covers links out of the SPA, `navigate()` to such a page and links on MPA pages. TASK-296 had made the browser ask (`beforeunload`) for these.
  - The browser prompt stays for `"leave"`, which the page cannot stop. This follows the decision's own wording ("for `"leave"`, `cancel()` makes the browser show its own prompt") and SvelteKit, which prevents a cancelled click on an external link.
  - It also gives apps one rule: a hook cancels `"leave"` and asks with its own UI for everything else. Before, `willUnload` mixed both cases, and a dialog for a link out of the SPA was followed by the browser's prompt.
