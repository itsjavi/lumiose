---
id: TASK-101
title: href() respects the Vite base path
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:58'
updated_date: '2026-10-08 22:34'
labels: []
milestone: m-3
dependencies:
  - TASK-21
priority: medium
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Beacon found (TASK-57) that the typed href() ignores Vite's base, so apps/web had to write its own link() helper for GitHub Pages builds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 href() prefixes the configured base (dev, build, prerender, SPA router) and honours trailingSlash; apps/web switches back to href(); tests and docs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. app/routes/href.ts: split the pattern filler (base-less, for prerender) from href(); href() prefixes Vite's base (import.meta.env.BASE_URL, normalized like the handler's) and applies trailingSlash ("always" adds / except root and file-like final segments such as /feed.xml; "never"/"ignore" leave paths bare).
2. trailingSlash reaches every environment through a define, import.meta.env.LUMEN_TRAILING_SLASH, set by lumen dev (lumenDev config hook) and lumen build (lumenBuild config hook) from lumen({ trailingSlash }) or the dev/build override. lumen is noExternal and not pre-bundled, so Vite replaces both in SSR and client code (dev, build, prerender = the built server).
3. prerender uses the base-less filler; handler shares normalizeBase.
4. SPA router: works on full URLs already (routePath strips base); edit only if a test shows otherwise.
5. Tests: href unit tests (stubEnv), build e2e (base /sub/ + always: SSR links + client chunk), dev e2e with base.
6. Docs: routing/href reference, vite trailingSlash note.
7. apps/web: swap link() for href() on route links if Beacon's files are untouched; else note for Beacon.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (nova-20261008T221802Z): claimed.

Nova: done.
- href() (app/routes/href.ts) = fillPattern (base-less, also used by prerender) + appPath(base, slash). base = Vite's import.meta.env.BASE_URL (normalized like the handler; normalizeBase now shared from href.ts). trailingSlash = import.meta.env.LUMEN_TRAILING_SLASH, a define set by lumenDev's and lumenBuild's config hooks from lumen({ trailingSlash }) or the dev/build override (project.ts: hrefDefine, configProjectOptions reads lumen() among raw config plugins; BuildState.trailingSlashOption + trailingSlash now set in the config hook). lumen is noExternal and excluded from optimizeDeps, so Vite fills both in SSR and client code; outside Vite (plain Node, Vitest without the app plugins) paths stay root-relative / 'ignore'.
- "always": slash on every path but the root (which is the base itself) and file-like patterns (dot in the last segment outside params: /feed.xml, /llms.txt). Endpoints without an extension get the slash (the handler matches them either way).
- SPA router: no source change needed (it works on full URLs and strips config.base). Spark's dir: router.test.ts only, config(base)/boot(…, base) params + one test navigating href() links under /sub/ with "always".
- apps/web (Beacon's; untouched in git before the edit): route links switched from link() to href() (site.ts nav/footer, document llms.txt, docs.ts topicUrl, _404, _layout home, docs search index, /errors redirects, landing page). link() stays for non-route URLs (favicon in public/, /playground app) and the current-path computation. docs.ts imports href as routeHref (it has href locals).
Evidence: href.test.ts (base, full-URL/relative base, always/never/ignore, file-like patterns); build.test.ts 'builds href() below the base, with trailingSlash: always …' (prerendered /sub/blog/hello/, /sub/feed.xml, island SSR, client runtime chunk has no import.meta/LUMEN_TRAILING_SLASH left; unminified check showed href folded to normalizeBase("/sub/") and the always test to true); dev-server.test.ts 'lumen dev below a base' (SSR links + browser module env); router.test.ts. apps/web built with LUMEN_BASE=/lumen/ (scratch copy): every internal href, the search index URL and the /errors redirect targets carry /lumen/. Docs: reference/app.md#href (table), concepts/routing.md. pnpm typecheck, pnpm test (1060 passed), pnpm lint clean; apps/web lumen check + vitest green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
href() now prefixes Vite's base and follows lumen({ trailingSlash }) in dev, build, prerender and the SPA router, via import.meta.env.BASE_URL and a LUMEN_TRAILING_SLASH define set by lumen dev/build. Prerender uses the base-less pattern filler. apps/web route links use href() again; link() remains for public files and the playground. Tests: unit, build e2e, dev e2e, router; docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
