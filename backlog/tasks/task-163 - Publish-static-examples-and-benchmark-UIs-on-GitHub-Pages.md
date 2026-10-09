---
id: TASK-163
title: Publish static examples and benchmark UIs on GitHub Pages
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 11:53'
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
- [ ] #1 build:site assembles site + examples + benchmark UIs; preview:site serves it under /lumen/; link crawl clean; each example works in the browser pane
- [ ] #2 Website has Examples and Benchmarks sections linking them (with short descriptions); pages.yml builds everything
- [ ] #3 Dotmatrix excluded behind a flag documented in the task until the user confirms
<!-- AC:END -->
