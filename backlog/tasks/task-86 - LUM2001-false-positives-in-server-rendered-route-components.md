---
id: TASK-86
title: LUM2001 false positives in server-rendered route components
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 20:57'
updated_date: '2026-10-08 22:07'
labels:
  - bug
  - compiler
  - dx
dependencies: []
priority: medium
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
LUM2001 ("computed once from a reactive value") fires on ordinary server pages, which render once (mode server/static), so sample apps are noisy or need workarounds. Found in TASK-36 (bookshelf), crates/lumen_compiler/src/analyze/reactivity.rs heuristic "zero-argument call of a local or imported binding":

- `const book = queries().getBook(isbn)` where `queries` is imported from a `*.server.ts` module (server-only; never a signal).
- `const user = locals().user ?? null`, `const next = url().searchParams.get("next")`, `const search = url().searchParams` warn, while `const filters = parse(url().searchParams)` does not (the heuristic depends on the expression shape, not on what is read).
- `const featured = queries().featuredBooks(6)` in the home page.

Workaround used in the bookshelf: pass data inline in JSX props to a child component (`<BookDetail book={findBook(params.isbn)} user={locals().user ?? null} />`), or wrap reads in a helper call.

Suggestions: treat imports from server-only modules (`*.server.ts`, `src/server/**`) as non-reactive; treat lumen request APIs (`url`, `locals`, `params`, `cookies`, `request`) consistently (non-reactive outside spa routes); or skip LUM2001 in route modules whose mode (own export or layout) is server/static.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The three cases above produce no LUM2001 in server-mode route modules
- [x] #2 Real stale derivations (signals, props in client components) still warn
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Refine the reactive-read heuristic (analyze/reactivity.rs) instead of gating by target: zero-argument calls rooted at server-only bindings are not reads. Server-only bindings = imports of lumen's request APIs (url, params, locals, cookies, request, response, publicEnv: they throw LUM4003 in the browser; SPA routes use lumen/router's reactive url/params) and every import of a server-only module (*.server.* or under <root>/src/server/, module_id::is_server_only_import). Applies to LUM2001 and LUM2003 for every target, so Vite, lumen check and the language server agree. Golden fixture server-reads.tsx; LUM2001 docs page.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: implemented. Why not target gating: lumen check and the language server compile every file with target client, so gating LUM2001 on the server target would make check and dev disagree; the request APIs and server-only modules are server-only by contract (browser stubs throw LUM4003; LUM4003 forbids server modules in client graphs), so the rule holds for any target. LUM2003 (reactive early return) benefits too: `if (!locals().user) return …` is no longer an error. Remaining limitation (not in the ACs): derivations from a server page's own props (`const title = params.slug.toUpperCase()` in a server-mode page) still warn; skipping them needs the route mode (Vite env or lumen check knowing route modes), a possible follow-up for Lux/Beacon.

Evidence: golden crates/lumen_compiler/tests/fixtures/client/server-reads.{tsx,js,server.js}: the server page (queries().getBook, queries().featuredBooks(6), locals().user ?? null, url().searchParams.get, url().searchParams, an import from ./server/session.ts, if (!locals().user) return) has no diagnostics; the island still warns for count() * 2, props.isbn.toUpperCase() and lumen/router url(). module_id unit test server_only_imports. cargo test/clippy/fmt -p lumen_compiler green; pnpm test 1013/1014 (the failure is docs.test llms freshness from Beacon's in-progress docs: README/cli.md/mcp.md).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LUM2001/LUM2003 no longer treat calls of server-only bindings as reactive reads: lumen's request APIs (url, params, locals, cookies, request, response, publicEnv) and imports of server-only modules (*.server.*, src/server/**). Server pages can store request data and query results in constants without warnings; signals, props and lumen/router accessors still warn. Docs: errors/LUM2001.md explains what counts as a read.
<!-- SECTION:FINAL_SUMMARY:END -->
