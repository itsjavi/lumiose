---
id: TASK-22
title: 'Implement request handling, middleware, endpoints and document'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 12:37'
labels: []
milestone: m-3
dependencies:
  - TASK-21
  - TASK-16
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Server and static routes need a web-standard fetch handler that composes middleware, endpoints, pages, layouts and error pages, with correct status and redirects (decisions 18-19).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 export default { fetch } entry; ctx { request, url, params, locals, cookies, env }; typed Locals; middleware chain; endpoints for every method
- [ ] #2 cookies with signedCookie(); redirect/notFound/error helpers; env() with PUBLIC_ client env; default and custom document.stsx; _404/_error pages with status
- [ ] #3 Integration tests over the fetch handler
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: may start before TASK-16. Build the fetch handler, middleware, endpoints, cookies, redirects and document against a small render interface; integrate renderToStream and add the end-to-end tests once TASK-16 is Done (the dependency stays for completion).
<!-- SECTION:NOTES:END -->
