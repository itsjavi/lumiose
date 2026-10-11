---
id: TASK-237
title: >-
  Docs: choosing and combining rendering modes, close-to-PPR patterns, Astro
  comparison
status: To Do
assignee:
  - Beacon
created_date: '2026-10-11 03:32'
labels:
  - docs
  - rendering
dependencies:
  - TASK-236
priority: medium
ordinal: 239000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend `packages/lumiose/docs/concepts/rendering-modes.md` (rather than adding a second page) so it explains each mode by purpose, how modes and per-component features combine, how to get close to Next.js partial prerendering, and how Lumiose islands compare with Astro's. Concept pages keep exactly five `##` sections (docs.test.ts), so the new material goes in `###` subsections at the top of Concept, before the existing mechanics (shell-first streaming, hydration, SPA mode, build).

New subsections:
1. **Choosing a mode**: `static`, `server`, `spa` (per request), `spa` + `prerender`, `spa` + `ssr = false`: what each is for, with typical pages (docs/marketing, personalized or fresh pages and forms, app-like UIs, SEO'd app pages, browser-only tools), what it costs (server per request, JS shipped, hosting) and the sample app that shows it.
2. **Granularity and combining**: the levels (project default, layout, page for `mode`/`ssr`/`prerender`; component level for `client:*` islands and `<Suspense>`), a matrix of what combines (islands in `static` and `server` pages; `<Suspense>` streams only in `server`, resolved fully in `static`/prerender; an `spa` subtree under server-rendered layouts; `prerender` + `ssr = false` is LUM5006; request APIs only per request), and one app mixing modes (bookshelf).
3. **Close to partial prerendering**: what PPR is; the two patterns available today (`server` + `<Suspense>`, `static` + islands) with their trade-offs; that streamed boundaries need JS (`$swap`) unless the browser applies `<template for>`, so keep essential forms out of streamed holes; good and poor candidates; the bookshelf pages that show each pattern (TASK-236). State plainly that a prebuilt-shell mode is not available.
4. **Compared with Astro islands**: the same idea and directive names, and the differences (single renderer, comment markers + JSON records instead of wrapper elements, event replay, awaited data replayed, scoped state shared by islands, SPA subtrees with a client router, no `server:defer`, for which `server` + `<Suspense>` streams in the same response). Verify current Astro behaviour against its docs (find-library-docs) and the TASK-1 survey.

Verify every claim about Lumiose against the code and the existing pages; do not document behaviour that does not exist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 rendering-modes.md has Choosing a mode, Granularity and combining, Close to partial prerendering and Compared with Astro islands subsections, with the five concept sections intact
- [ ] #2 Every Lumiose claim is checked against the code; Astro claims are checked against current Astro docs, with the date in the task notes
- [ ] #3 islands.md and the docs README link to the new subsections where relevant; the README line for Rendering modes reflects them
- [ ] #4 pnpm --filter lumiose docs:gen is run, and docs:check plus the docs tests (packages/cli/src/docs) pass
<!-- AC:END -->
