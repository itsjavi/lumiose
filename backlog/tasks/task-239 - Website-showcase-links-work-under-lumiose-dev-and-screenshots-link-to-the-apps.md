---
id: TASK-239
title: >-
  Website: showcase links work under lumiose dev, and screenshots link to the
  apps
status: Done
assignee:
  - Beacon
created_date: '2026-10-11 03:43'
updated_date: '2026-10-11 03:52'
labels:
  - site
milestone: m-7
dependencies: []
priority: high
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reported by the user (2026-10-11). Under `lumiose dev` for apps/web, the separately built apps that scripts/site.ts mounts return 404: /showcase/chiptune-tracker/, /showcase/dotmatrix/, /demos/travel-journal/, /demos/counter/, /benchmarks/fullstack/ and /benchmarks/js-framework-benchmark/app/. They only exist after `pnpm build:site`. The deployed site is fine. Fix: in dev, serve those mounts from their built output (dist/site, or each package's own dist), taking the mount list from scripts/site.ts so it isn't duplicated. When an app hasn't been built, answer with a dev-only page naming the command that builds it (pnpm build:site, or pnpm demo <name>), not a bare 404. Also make each showcase screenshot a link to its app (and the bookshelf's to its source). Avoid duplicate tab stops: the image link takes tabindex=-1 and aria-hidden, since the title and 'Open the app' links stay the accessible ones. The axe suite must still pass.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Under lumiose dev, every link on /showcase and /benchmarks either serves the built app or a dev page with the command to build it; no bare 404s
- [x] #2 Each showcase screenshot links to its app, with no duplicate tab stop, and the axe suite passes
- [x] #3 An e2e test (dev) covers a showcase link and a screenshot link
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: scripts/site-mounts.ts now holds the mount list (EXAMPLES plus the benchmark UIs, each with its package's output files); scripts/site.ts copies from it. apps/web/scripts/dev-mounts.ts is a serve-only Vite plugin (before Lumiose's middlewares) that serves each mount from dist/site/<mount> when its index.html was built for the dev base, else from the package's own output, with trailing-slash redirects and the app's own 404.html for missing paths (SPA deep links, as on Pages); otherwise a dev page (404) naming pnpm build:site [--base], the package build (jsfb) or pnpm demo <name>, and saying when a build exists for another base. Showcase screenshots are links (app, or source for the bookshelf) with tabindex=-1 and aria-hidden; hovering the shot or the title link highlights the shot border. New Playwright project dev (lumiose dev on :5196, e2e/showcase.dev.e2e.ts). Checks: web e2e 64 passed / 3 skipped (axe included), vitest 21 passed, lumiose check clean, oxlint clean on changed files, oxfmt clean.
<!-- SECTION:NOTES:END -->
