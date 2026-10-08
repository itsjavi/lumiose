---
id: TASK-57
title: 'Build the website: landing page at / and docs at /docs'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 21:57'
labels: []
milestone: m-5
dependencies:
  - TASK-59
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lumen needs a public website for humans and agents. apps/web is a Lumen SSG site with the marketing landing page at / and the documentation at /docs, rendered from the version-matched markdown in packages/lumen/docs (single source). It is built with Lumen, so it dogfoods the framework, and it uses the shared design system (@lumen/site-kit).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 apps/web (mode static): / landing page presenting the benefits with evidence (.stsx and first-class CSS: placement scopes, $tokens, build-time math via Lightning CSS; performance numbers from TASK-12/20; islands/SPA/SSG; agent-first tooling) and links to /docs and /playground
- [x] #2 /docs renders packages/lumen/docs markdown with no duplicated content: navigation, per-page TOC, prev/next, code highlighting incl. .stsx, dark mode, responsive; client-side search island over a prebuilt index; error pages at /docs/errors/LUMxxxx with redirects matching the URLs the runtime/compiler print; llms.txt and llms-full.txt at the site root
- [x] #3 Uses @lumen/site-kit; lumen build outputs a static site that works when served statically; lumen check passes; screenshots in backlog/assets
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. apps/web: a static Lumen app (lumen({ mode: "static" })), extending the generated tsconfig (TASK-73) to type-check @lumen/site-kit.
2. One content module (src/content/docs.ts): import.meta.glob ?raw of packages/lumen/docs + marked; nav order from docs/README.md, GitHub heading anchors, .md links rewritten to page URLs, code fences as site-kit CodeBlocks, search text. Swapping to .md imports (TASK-69) touches only this file.
3. Landing page with evidence parsed from benchmarks/*/RESULTS.md at build time, and compiler output checked by a test.
4. docs/[...path] (staticPaths), docs layout (sidebar nav, search island), TOC, prev/next; /errors/[code] redirects; llms.txt / llms-full.txt / search.json endpoints; 404.
5. Base path via LUMEN_BASE (vite base) and a link() helper, since href() does not add the base.
6. Unit tests (content), Playwright against the static build at / and /lumen/, screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: built and verified in Chromium (Playwright, 9 e2e tests against the static build served as plain files at / and at /lumen/ with LUMEN_BASE=/lumen/). lumen build prerenders 111 files in about 1 s. The docs link check in content.test.ts finds no broken internal links or anchors.
Known gaps:
- Pages emit modulepreload links that 404 for site-kit islands (TASK-98). Islands hydrate anyway; the e2e tests tolerate only those URLs.
- /playground is linked but 404s until TASK-58.
- href() ignores Vite's base, so the site uses link() (src/lib/site.ts).
- apps/* is not in the root vitest projects (root config, Lux). Run the unit tests with pnpm --filter @lumen/web test.
- pnpm-lock.yaml gained the apps/web importer, for Lux to commit.
- For TASK-60: the runtime prints https://lumen.dev/errors/LUMxxxx; the site serves /errors/LUMxxxx redirects at whatever host it gets. Pages are dir/index.html, so GitHub Pages adds a trailing-slash redirect per navigation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
apps/web (@lumen/web) is the Lumen website: a static Lumen app built with @lumen/site-kit. / presents Lumen: .stsx with real compiler output, scoped styles, $tokens and build-time math, rendering modes and islands, and agent-first tooling. Benchmark charts read the committed js-framework-benchmark and SSR results at build time. /docs renders packages/lumen/docs from one content module: section navigation, per-page TOC, prev/next, highlighted CodeBlocks with copy, a client:idle search island over a prebuilt /search.json, dark mode and a mobile disclosure menu. Diagnostics are at /docs/errors/LUMxxxx, and /errors/LUMxxxx redirects there. llms.txt (links pointing at the site) and llms-full.txt are served at the root. LUMEN_BASE builds for a base path. Checks: lumen check, lumen lint and unit tests (content, links, evidence, search, compiler sample); 9 Playwright tests against the static build. Screenshots: backlog/assets/task-57-{home,docs}-{light,dark}.png, task-57-{home,docs}-phone.png, task-57-search.png, task-57-diagnostic.png. Follow-ups: TASK-98 (preload 404s), TASK-99 (scan of nested projects).
<!-- SECTION:FINAL_SUMMARY:END -->
