---
id: TASK-163
title: Publish static examples and benchmark UIs on GitHub Pages
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 11:53'
updated_date: '2026-10-09 12:06'
labels:
  - site
  - ci
milestone: m-7
dependencies: []
priority: medium
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: publish, together with the website, the example apps that need no server under /examples/<name>/, the benchmarks that have a web UI, and link them from the website. Include: examples/spa-chiptune (runs without cross-origin isolation on Pages; it falls back), examples/ssg-travel-journal, examples/vite-counter; NOT spa-dotmatrix until the user confirms gbapu redistribution rights; ssr-bookshelf needs a server (link to code + screenshot instead). Benchmarks: the fullstack results viewer with committed results at /benchmarks/fullstack/, the js-framework-benchmark results page and the built Lumen benchmark app at /benchmarks/js-framework-benchmark/. Base paths under the Pages base; deep links work (404 fallbacks for SPA routes).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 build:site assembles site + examples + benchmark UIs; preview:site serves it under /lumen/; link crawl clean; each example works in the browser pane
- [x] #2 Website has Examples and Benchmarks sections linking them (with short descriptions); pages.yml builds everything
- [x] #3 Dotmatrix excluded behind a flag documented in the task until the user confirms
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): scripts/site.ts builds, besides apps/web and the playground, examples spa-chiptune, ssg-travel-journal and vite-counter with LUMEN_BASE=<base>examples/<name>/ (each vite.config reads LUMEN_BASE; the journal's public assets and feed links go through asset()/href()), copies them to examples/<name>/ (without .br/.gz/_headers), the fullstack viewer + results/*.json to benchmarks/fullstack/, and the jsfb app (dist/main.js + benchmarks/js-framework-benchmark/demo/ page with a small Bootstrap stand-in) to benchmarks/js-framework-benchmark/app/. Deep links: GitHub Pages serves the root 404.html for any missing path, so site.ts injects a script there that, below an example with its own 404.html, swallows the rest of the page (<plaintext>, so the site's scripts never run) and document.writes the example's 404.html (chiptune's SPA shell routes the URL; the journal shows its own 404). DOTMATRIX FLAG: spa-dotmatrix is excluded unless build:site --with-dotmatrix, pending the user's confirmation of gbapu redistribution rights. ssr-bookshelf: Examples page shows a screenshot (apps/web/public/examples/ssr-bookshelf.png, from a local production run) and links its source. Website: /examples and /benchmarks pages (components/Showcase.stsx, content/showcase.ts), /benchmarks/js-framework-benchmark renders RESULTS.md at build time; header nav, footer column 'See it run', landing 'Example apps' section and a docs sidebar group. pages.yml: header comment only (it already runs build:site; Photon's TASK-161 workflows untouched). Validation: build:site --base /lumen/ OK; preview:site + link crawl 157 URLs, 0 broken; Playwright visit of every page incl. chiptune deep link reload and journal 404: no page errors; browser pane checks; journal e2e 17/17; lumen check clean (web, journal). Screenshots: backlog/assets/task-163-{landing,examples,benchmarks,jsfb-results,jsfb-app,fullstack,chiptune-deeplink,journal,counter}.png. Repo links point at github.com/itsjavi/lumen (private for now).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
GitHub Pages now publishes the serverless examples under /examples/<name>/ and the benchmark UIs under /benchmarks/ with the website, linked from new Examples and Benchmarks pages, nav, landing and docs sidebar; deep links fall back through the root 404; dotmatrix behind --with-dotmatrix.
<!-- SECTION:FINAL_SUMMARY:END -->
