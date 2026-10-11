---
id: TASK-227
title: >-
  lumiose routes and check read lumiose({ prerender }) and show prerendered spa
  pages
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-11 01:48'
updated_date: '2026-10-11 02:14'
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
- [x] #1 routeOptions() passes defaultPrerender from lumiose({ prerender })
- [x] #2 lumiose routes shows prerendered spa pages (e.g. 'spa (prerendered)') and includes prerender in --format json; reference/cli.md and reference/mcp.md updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: routeOptions() passes defaultPrerender, so lumiose routes, lumiose check, typegen and the MCP routes tool resolve prerender from lumiose({ prerender }) with layout inheritance (PageRoute.prerender from TASK-229). RouteInfo gains prerender (pages), the table labels 'spa (prerendered)'. Test: cli.test.ts spa project with lumiose({ mode: 'spa', prerender: true }) plus an ssr = false shell. Docs: reference/cli.md, reference/mcp.md, llms-full.txt regenerated. Checks: packages/cli vitest 95/95, tsc clean, docs:check green, oxlint no new warnings.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose routes/check/typegen and MCP routes read lumiose({ prerender }); routes shows 'spa (prerendered)' and reports prerender in JSON. Docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
