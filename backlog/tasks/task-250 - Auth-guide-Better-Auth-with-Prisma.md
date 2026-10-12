---
id: TASK-250
title: 'Auth guide: Better Auth with Prisma'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-12 18:39'
labels:
  - docs
  - examples
milestone: m-9
dependencies: []
priority: high
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a dedicated docs page. Better Auth's handler as an endpoint (/api/auth/[...all]), middleware putting the session in the request context, protected routes with redirects, sign-in/sign-out form actions, Better Auth's client in islands, Prisma as a server-only module (*.server.ts, LUM4003).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A docs page covering setup, session in middleware, protected routes, forms and islands
- [ ] #2 A small example app follows the guide, with an e2e test of sign-up, sign-in, a protected page and sign-out
<!-- AC:END -->
