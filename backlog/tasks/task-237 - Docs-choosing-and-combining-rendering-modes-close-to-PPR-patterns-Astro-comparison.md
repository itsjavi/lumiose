---
id: TASK-237
title: >-
  Docs: choosing and combining rendering modes, close-to-PPR patterns, Astro
  comparison
status: Done
assignee:
  - Beacon
created_date: '2026-10-11 03:32'
updated_date: '2026-10-12 22:03'
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
- [x] #1 rendering-modes.md has Choosing a mode, Granularity and combining, Close to partial prerendering and Compared with Astro islands subsections, with the five concept sections intact
- [x] #2 Every Lumiose claim is checked against the code; Astro claims are checked against current Astro docs, with the date in the task notes
- [x] #3 islands.md and the docs README link to the new subsections where relevant; the README line for Rendering modes reflects them
- [x] #4 pnpm --filter lumiose docs:gen is run, and docs:check plus the docs tests (packages/cli/src/docs) pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon 2026-10-12: rendering-modes.md Concept gets four ### subsections before the mechanics (Choosing a mode, Granularity and combining, Close to partial prerendering, Compared with Astro islands), then '### How pages render' before the existing shell-first/hydration/SPA text and '### Build' before the build paragraph (it used to sit under Prerendered SPA routes). The five ## sections are unchanged. islands.md links to #compared-with-astro-islands, #close-to-partial-prerendering and #choosing-a-mode; the README (and llms.txt) line for Rendering modes lists the new subsections.
Verified against the code: modes per sample app with lumiose routes (bookshelf static/server/endpoints, spa-* prerendered, spa-router-e2e spa per request and /csr shell, ssg-travel-journal static); Suspense: resolveAll for static and prerendered pages (handler.ts renderPage, dev plugin prerender: static || prerender), synchronous content folds into the shell (server/components.ts), streamed chunks are <template for> + $swap (server/render.ts); spa per request streams too (checked: lumiose dev of spa-router-e2e, /slow has <?start>, <template for> and $swap), so the matrix says streaming per request, not only in server; SPA subtree starts at the outermost spa layout (router/table.ts spaPagePart); islands inside an island or SPA render inline without a record (server/island.test.ts); static page with an action (examples/ssr-deploy /form); LUM5001/5004/5005/5006 from the existing pages.
Astro: checked 2026-10-12 against docs.astro.build sources (withastro/docs main: guides/server-islands, concepts/islands, reference/directives-reference, recipes/sharing-state-islands, guides/view-transitions), astro source (packages/astro/src/runtime/server/astro-island.ts: <astro-island> with component-url/renderer-url/props attributes, no early-event replay) and npm (astro 7.3.8), plus the TASK-1 survey. Next.js PPR wording checked against the Next.js docs (Cache Components, next 16.4.0).
TASK-236 is still In Progress (Nova): the book page paragraph follows its task definition and was checked against the in-progress code (books/[isbn]/page.stsx header comment and holes, (app)/layout.stsx account Suspense) at 2026-10-12 22:00 UTC; re-check it when TASK-236 lands.
Checks: docs:gen, docs:check, packages/cli/src/docs tests and apps/web tests green; the page renders in lumiose dev of apps/web with the new anchors.

Beacon 2026-10-12 22:10 UTC: Nova committed the TASK-236 book page (c118855c); the paragraph matches the committed code (shell reads only the route param; account area, reading-list toggle, Your review, rating summary/histogram and reviews are synchronous Suspense holes, no streamed chunks). TASK-236 itself was not yet marked Done.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
rendering-modes.md now explains choosing a mode (purpose, typical pages, costs, sample apps), granularity and combining (levels and a matrix of islands, Suspense and request APIs per mode), the two patterns close to partial prerendering (with the bookshelf pages) and a comparison with Astro islands, verified against the code and Astro 7.3 docs. islands.md and the README link to them.
<!-- SECTION:FINAL_SUMMARY:END -->
