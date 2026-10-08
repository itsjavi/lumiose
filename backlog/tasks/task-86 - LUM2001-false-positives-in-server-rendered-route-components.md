---
id: TASK-86
title: LUM2001 false positives in server-rendered route components
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 20:57'
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
- [ ] #1 The three cases above produce no LUM2001 in server-mode route modules
- [ ] #2 Real stale derivations (signals, props in client components) still warn
<!-- AC:END -->
