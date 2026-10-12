---
id: TASK-242
title: 'Fullstack benchmark: Astro port'
status: Done
assignee:
  - Quasar
created_date: '2026-10-11 03:48'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 244000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11: Astro gets a fullstack app, so the stack table's 'Requests' and 'JS on a server page' cells can be measured for the other 0 kB framework. Port the doc-4 issue tracker to Astro in benchmarks/fullstack/apps/astro: server output (adapter-node), Astro components for the pages, and the interactive parts as Preact islands (the lightest common integration; record the choice and why in doc-4). Use the latest stable versions (decision-41), with production settings comparable to the others. Pass conformance; register it in the harness and the viewer. No quick bench passes now: the user's machine is busy, and TASK-235 measures it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 benchmarks/fullstack/apps/astro implements the doc-4 app idiomatically and passes conformance; versions and caveats are in doc-4
- [x] #2 The harness and viewer know the app; measurement is left to TASK-235
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar 2026-10-11: Astro port in benchmarks/fullstack/apps/astro (port 4108, viewer series-8). astro 7.3.8, @astrojs/node 11.1.7 (standalone, no compression), @astrojs/preact 6.0.6 with preact 10.29.8 (the integration requires Preact 10). Pages and components are .astro; the search box, bulk-select bar, comment composer and label picker are Preact islands (client:load). Forms are plain POSTs to their own page (303 or 400), not Astro Actions (doc-4 §8 says why). Astro streams HTML in order, so the comments are a server island (server:defer + fallback) and the app is registered with comments: "client", like Nuxt. Dev runs `astro dev --ignore-lock`, since Astro 7 backgrounds the dev server under AI agents. The app pins @emnapi/runtime 1.11.3 so that astro check loads (the peer resolved to the compiler's 2.0.0-alpha.5). Registered in harness apps.ts, meta.versions (astro, @astrojs/node, @astrojs/preact, preact), the .astro source-size extension, the viewer and doc-4 (§1, §3, §4, §5, §8). Checks: conformance 15/15 pass, astro check 0 errors, harness tsc, oxlint and oxfmt clean, production build OK. No bench pass was run (machine busy). Only TASK-235's measurement remains.

Lux 2026-10-12: measured in results/2026-10-12T114559-macbookpro.json (fd2723b); passes conformance.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Astro port measured in the 2026-10-12 quiet-machine run (TASK-235): home 1,289 req/s, 0 kB JS on the home page, 7 kB on the issue page (brotli), 1 runtime dep.
<!-- SECTION:FINAL_SUMMARY:END -->
