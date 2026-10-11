---
id: DRAFT-2
title: 'Spike: partial prerendering (prebuilt shell, per-request streamed holes)'
status: Draft
assignee:
  - Nova
created_date: '2026-10-11 03:29'
updated_date: '2026-10-11 03:32'
labels:
  - spike
  - ssr
  - rendering
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate, then try in a throwaway spike, a Next.js-style partial prerendering (PPR) mode: the build prerenders a route's shell with its `<Suspense>` fallbacks in place; each request sends those prebuilt bytes at once, then renders and streams only the boundaries over the existing out-of-order streaming path (`<template for>` / `$swap`).

Today the closest options are `server` mode + `<Suspense>` (same response, but the shell renders per request) and a `static` page + `client:*` islands (prebuilt, but per-user parts are fetched after JS loads). See the "Close to partial prerendering" section of the rendering-modes guide.

Expected benefits: first byte without shell work, earlier `<head>` (CSS, fonts, preloads), less CPU per request if only the holes render, and a build-time guarantee that the shell does not read the request. Expected limits: still needs a server per request (no static hosting), small gain when the shell is cheap, and no CDN edge composition with only `@lumiose/adapter-node`.

Open questions for the investigation:
- Request-time rendering: re-run the whole tree and drop the shell output (simple, CPU still per request) vs. resuming from state recorded at build time (Next's postponed state).
- Shell rules: the shell cannot read the request (LUM5001 at build) and head/status are fixed in the shell (LUM5004). Auth-gated routes (redirect decided per request) cannot use it.
- Without JavaScript, streamed holes need `$swap` unless the browser applies `<template for>` natively, so essential per-user forms in holes stop working without JS.
- Strict CSP: a prebuilt shell cannot carry a per-request nonce; its inline scripts need hashes while streamed chunks keep a nonce (one header with both?).
- Caching: the shell is public, the combined response is private; where the shell bytes live (memory, `dist/client`, adapter).
- Islands and scoped state inside holes; the page payload and island records split between shell and chunks.
- Authoring syntax (for example a `prerender` value on `server` routes) is a DX decision: propose options, the user approves before anything is recorded.

Test bed: `examples/ssr-bookshelf` book page (`/books/[isbn]`), whose reader-independent shell and per-reader holes are being made explicit, plus `benchmarks/ssr` and `benchmarks/fullstack` for measurements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Investigation notes in this task answer each open question, with the chosen request-time strategy and its rationale
- [ ] #2 A throwaway prototype (worktree or branch, not merged) serves the bookshelf book page with a prebuilt shell and streamed holes
- [ ] #3 Measured TTFB, first paint and server CPU per request vs. server mode + Suspense on the same page, with the method and machine recorded
- [ ] #4 A go/no-go recommendation; on go, follow-up tasks and authoring-syntax options proposed to the user (nothing public recorded without approval)
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Lux
created: 2026-10-11 03:32
---
Related: TASK-236 makes the bookshelf book page the shell + holes test bed (holes kept no-JS, user decision 2026-10-11); TASK-237 documents the close-to-PPR patterns in concepts/rendering-modes.md.
---
<!-- COMMENTS:END -->
