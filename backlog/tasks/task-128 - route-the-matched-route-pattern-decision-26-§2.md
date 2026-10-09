---
id: TASK-128
title: 'route(): the matched route pattern (decision-26 §2)'
status: Done
assignee:
  - Spark
created_date: '2026-10-09 04:26'
updated_date: '2026-10-09 04:38'
labels:
  - router
  - app
dependencies: []
priority: medium
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §2: route() returns the matched pattern typed as Routes, available wherever url()/params() are (server render, client router, islands). Lux authorises the matching edits in app/server for the server side.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 route() works on the server, in the SPA router and in islands; typed as the Routes union
- [x] #2 spa-chiptune nav.ts uses route() instead of pathname matching; docs and tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: route(): Routes | undefined. Server: the request scope keeps the matched pattern (RequestScope.route, set by the handler), read by route() from lumen and from lumen/router's node entry; the browser lumen entry throws LUM4003 like url(). Client router: View.route (formatPattern of the matched ClientRoute's segments), reactive through the route scope like params()/url(), so it works in SPA pages, layouts and islands inside them. undefined when no route matched (_404 for an unknown URL); a matched route that throws notFound() keeps its pattern on server and client. Kept on the existing Routes union so TASK-127's typing changes compose. spa-chiptune nav.ts currentView() switches on route(). Tests: router.test.ts, handler-build.test.ts, public-api.test.ts (browser stub + typed usage with @ts-expect-error for an unknown pattern); spa-chiptune unit 10/10 and Playwright 18/18. Docs: reference/router.md, reference/app.md, concepts/routing.md (common mistake), concepts/server.md.
<!-- SECTION:NOTES:END -->
