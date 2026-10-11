---
id: TASK-227
title: >-
  lumiose routes and check read lumiose({ prerender }) and show prerendered spa
  pages
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-11 01:48'
labels:
  - cli
  - app
milestone: m-7
dependencies: []
priority: low
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-216 (decision-38) added PageRoute.prerender and the project option lumiose({ prerender }). packages/cli/src/project.ts routeOptions() passes defaultMode/defaultSsr to the route manifest but not defaultPrerender, so lumiose routes --format json reports prerender from page exports only; and packages/cli/src/routes.ts labels ssr = false pages 'spa (shell)' but has no label for prerendered spa pages. Diagnostics are unaffected (LUM5006 only depends on page exports; the prerender+ssr:false project combination is rejected by the plugin).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 routeOptions() passes defaultPrerender from lumiose({ prerender })
- [ ] #2 lumiose routes shows prerendered spa pages (e.g. 'spa (prerendered)') and includes prerender in --format json; reference/cli.md and reference/mcp.md updated
<!-- AC:END -->
