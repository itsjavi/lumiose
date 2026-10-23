---
id: TASK-536
title: 'LUM2001: report copies of accessor props and router params()/url()'
status: Done
assignee:
  - Photon
created_date: '2026-10-23 19:36'
updated_date: '2026-10-23 21:33'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 529000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-529 made LUM2001 report `const n = count()` for signals, computeds, resources and optimistics made in the same file. Two kinds of copy stay unreported: destructured accessor props (`const { value } = props; const v = value()`) and the accessors of lumiose/router (`params()`, `url()`, `searchParams()`). Decide which can be reported without false positives (decision-77: errors for signal reads, warnings for prop reads) and report them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LUM2001 reports a copied accessor prop and copies of router accessors that are reactive, with tests and the golden updated
- [x] #2 No new false positives in apps/web, the examples, ui, site-kit or the fullstack app
- [x] #3 The LUM2001/LUM2003 pages describe what is and is not reported
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (worktree run for Lux, 2026-10-23). Decision (diagnostic heuristics, delegated): report what is reactive for every component that renders in the browser, leave out what is stable for a page's whole life.

- Destructured accessor props: const { value } = props (or a destructured parameter); const v = value() is a Signal copy, exactly as const v = props.value() already was (decision-77 counts a zero-argument call of an accessor prop as a signal read). LUM2001 warns; an early return through the local is a LUM2003 error.
- lumiose/router: url(), searchParams() and isNavigating() copies are reported. The router keeps the page on a query-only navigation (url() and searchParams() change), and isNavigating() changes on every navigation. params(), route() and locale() copies are not: a page with other params is a new page (router reference, 'Persistent layouts'), so they only change for a layout's code, which the compiler cannot tell from a page's; reporting const { id } = params() would flag every SPA page. The member form const id = params().id already warned before and still does (left as is, see the follow-up task).
- In the default export of a static or server route (server_route), lumiose/router's accessors read the request: they are plain values, like its props, for LUM2001 and LUM2003. This removes the existing reports of url().pathname there and keeps the new copies from becoming false positives.

Implementation (9a0b344b): analyze/reactivity.rs router_accessors() (all six, and the three that change); analyze/mod.rs derivation() treats a zero-argument call of a destructured prop or a changing router accessor as a Signal copy, reactive_context() adds the router accessors to the plain set of server_props components. Tests: compile_api.rs accessor_props_and_changing_router_accessors_are_stale_copies (client and server_route); diagnostics.tsx golden gains Results (query(), url(), params()). Docs: errors/LUM2001.md (what is and is not reported, the router bullet), errors/LUM2003.md (signal bullet, server routes). Repo scan with the rebuilt binding (lumiose check --format json in apps/web, packages/ui, packages/site-kit, benchmarks/fullstack/apps/lumiose and all 13 examples): no LUM2001/LUM2003 diagnostics before or after; a temporary file confirmed lumiose check reports the new cases.

Follow-up recorded as TASK-546 (params()/route()/locale() in pages vs layouts, needs the module's route kind).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2001 now reports, as signal copies, a destructured accessor prop called straight into a local (const v = value(), as props.value() already was) and url(), searchParams() and isNavigating() from lumiose/router, whose values change while a page stays mounted (query-only navigations, every navigation); an early return through such a local is a LUM2003 error (decision-77). Copies of params(), route() and locale() are left out: a page with other params is a new page, so they only change for a layout's code, which the compiler cannot tell from a page's (follow-up TASK-546; the member form params().id still warns, as before). In the default export of a static or server route, lumiose/router's accessors read the request and are plain values, like its props. Tests: compile_api.rs accessor_props_and_changing_router_accessors_are_stale_copies, diagnostics.tsx golden (Results). Docs: errors/LUM2001.md and errors/LUM2003.md. lumiose check over apps/web, packages/ui, packages/site-kit, benchmarks/fullstack/apps/lumiose and the 13 examples: no LUM2001/LUM2003 before or after. pnpm check, cargo fmt and clippy green.
<!-- SECTION:FINAL_SUMMARY:END -->
