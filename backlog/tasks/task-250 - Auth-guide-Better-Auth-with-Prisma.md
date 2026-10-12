---
id: TASK-250
title: 'Auth guide: Better Auth with Prisma'
status: Done
assignee:
  - Beacon
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 20:41'
labels:
  - docs
  - examples
milestone: m-9
dependencies:
  - TASK-253
priority: high
ordinal: 252000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: a dedicated docs page. Better Auth's handler as an endpoint (/api/auth/[...all]), middleware putting the session in the request context, protected routes with redirects, sign-in/sign-out form actions, Better Auth's client in islands, Prisma as a server-only module (*.server.ts, LUM4003).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A docs page covering setup, session in middleware, protected routes, forms and islands
- [x] #2 A small example app follows the guide, with an e2e test of sign-up, sign-in, a protected page and sign-out
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: reassigned Nova -> Beacon (doc-heavy; Nova overloaded). Beacon may create its example app under examples/.

Lux: the example uses Prisma with SQLite (no Postgres in CI), in examples/ssr-auth; it waits for TASK-253's route conventions.

Beacon 2026-10-12: started. Plan: examples/ssr-auth (Better Auth 1.7.7, Prisma 7.10 with the libsql driver adapter on a SQLite file, prisma-client generator into src/server/generated), docs page, Playwright e2e (sign-up, protected redirect, sign-in, sign-out, island). Prototype outside the repo: auth.api signUpEmail/signInEmail/getSession/signOut with returnHeaders give Set-Cookie headers to forward from form actions; APIError 401 on bad credentials; prisma generate works with pnpm's build scripts blocked and the schema engine downloads lazily on first migrate.

Beacon 2026-10-12, implementation:
- examples/ssr-auth (@lumiose-examples/ssr-auth): Better Auth 1.7.7 (email and password), Prisma 7.10 (prisma-client generator into src/server/generated/prisma, gitignored; libsql driver adapter on a SQLite file; committed init migration), adapter-node server.ts. Files: src/server/db.server.ts (lazy prisma()), src/server/auth.server.ts (lazy auth() so env() reads the request env and prerender never starts Better Auth; Locals.session; requireSession(); redirectWithCookies(); safeNext()), src/middleware.ts (getSessionCookie fast path, getSession with returnHeaders, renewed cookie forwarded), src/routes/api/auth/[...all]/route.ts (auth().handler), sign-up/sign-in/sign-out page actions (auth.api with returnHeaders; APIError -> fail(statusCode)), dashboard protected page, AccountMenu island with better-auth/client useSession in onMount on a prerendered home page.
- Docs: new Guides section, packages/lumiose/docs/guides/auth.md (setup, server-only Prisma/LUM4003, instance, handler, middleware, protected pages, forms, island client, production, common mistakes); docs/README Guides list; lumiose docs: guides/ in the section order; docs and website nav tests updated.
- Deps (under deps.lock): exact pins better-auth 1.7.7, @prisma/client 7.10.0, @prisma/adapter-libsql 7.10.0, @libsql/client 0.17.4, prisma 7.10.0 (dev), @playwright/test 1.63.0. Root pnpm-workspace.yaml allowBuilds: prisma and @prisma/engines set to false (pnpm 11 fails the install on unapproved build scripts; the Prisma CLI downloads its schema engine on first migrate, checked with a fresh HOME). Lockfile: no version change for other importers, no package removed (checked with a script).
- Findings: prisma generate reads tsconfig.json, which extends .lumiose/tsconfig.generated.json, so scripts run lumiose typegen first. auth.api calls are not rate-limited by Better Auth (documented). The Better Auth client makes the island chunk ~11.5 kB brotli (documented).

Evidence: Playwright e2e 5/5 against the production build on a fresh e2e DB (protected redirect, sign-up -> dashboard, form sign-out, sign-in back to next, island sign-out with the client, Better Auth errors 401/422 on the forms, the same flow without JavaScript). lumiose dev smoke: redirect, sign-up, session, client sign-out 200, cross-origin client post 403. From a clean state (no .lumiose, no generated client): pnpm typecheck ok. Repo checks: pnpm typecheck, lint, fmt:examples, test (1719 passed) all green. Screenshot: backlog/assets/task-250-dashboard.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Authentication guide and sample. packages/lumiose/docs/guides/auth.md (new Guides section) covers setup of Better Auth with Prisma on SQLite, Prisma as a server-only module (LUM4003), a lazily created Better Auth instance, its handler at src/routes/api/auth/[...all]/route.ts, middleware putting the session on ctx.locals, protected pages with redirects, sign-up/sign-in/sign-out form actions that forward Better Auth's cookies, Better Auth's browser client in an island, production notes and common mistakes. examples/ssr-auth follows it, with a Playwright e2e (5 tests, green) of sign-up, the protected page, sign-in and sign-out (form and island), errors and no-JS. Root allowBuilds gained prisma/@prisma/engines: false.
<!-- SECTION:FINAL_SUMMARY:END -->
