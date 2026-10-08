---
id: TASK-85
title: >-
  Serve .stsx stylesheet links in lumen dev (STYLE_QUERY misses Vite's direct
  query)
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 20:57'
labels:
  - bug
  - vite
  - css
dependencies: []
priority: high
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In lumen dev, the server links each route file's style module (`<link rel="stylesheet" href="/src/X.stsx?lumen&type=style&lang.css">`). The browser requests it with `Accept: text/css`, so Vite injects `direct` (`/src/X.stsx?direct&lumen&type=style&lang.css`). `STYLE_QUERY` in packages/lumen/src/vite/styles.ts was anchored as `/\?lumen&type=style&lang\.css$/`, so lumen/vite's `load` hook skipped the id, Vite read the raw .stsx source and served it as `text/css`: every SSR page in dev was unstyled (bookshelf, found by Nova in TASK-36). Builds are fine (CSS manifest).

Nova applied a minimal fix in the working tree (uncommitted, outside Nova's area): `STYLE_QUERY = /[?&]lumen&type=style&lang\.css(?:&|$)/` plus an assertion in src/vite/plugin.test.ts ("serves the scoped CSS of a file…": a `?direct&lumen…` request returns plain CSS with the scope token). The test fails without the fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A <link rel=stylesheet> request for a .stsx style module in lumen dev returns the compiled CSS (Vite direct request), with a test
- [ ] #2 HMR of linked style modules (t= query) still updates the stylesheet
- [ ] #3 The fix is reviewed and committed by the owner
<!-- AC:END -->
