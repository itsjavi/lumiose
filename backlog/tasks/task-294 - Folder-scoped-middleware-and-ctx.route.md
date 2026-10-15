---
id: TASK-294
title: Folder-scoped middleware and ctx.route
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 02:22'
updated_date: '2026-10-15 05:15'
labels:
  - middleware
  - routing
milestone: m-10
dependencies:
  - TASK-293
priority: high
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today the only middleware is `src/middleware.ts` (a function or an array), run for every page, form action and endpoint. Scoping it means testing `ctx.url.pathname`, and `ctx` has no matched route pattern. A layout can guard with `locals()` and `redirect()`, but that guard does not cover the folder's form actions or `route.ts` endpoints, so auth for a section such as `/admin` has no safe per-folder home.

Approved shape (decision-48): a `middleware.ts` in a route folder (same extensions as `src/middleware.ts`) runs for the pages, form actions and endpoints in its folder and below, group folders included, after `src/middleware.ts` and the route's locale checks, outermost folder first. `ctx.route` is the matched pattern (`undefined` in `src/middleware.ts` for unmatched URLs), and `Middleware<"/folder">` types `ctx.params` and `ctx.route`. `src/routes/middleware.ts` is LUM5002, pointing to `src/middleware.ts`. Folder middleware runs per request, for every route in dev, and at build time for prerendered pages; covering a prerendered route is a warning in `lumiose check` and the build. The manifest gives each page and endpoint a `middleware` list, built like `layouts`.

Code: packages/vite/src/app/project.ts (MIDDLEWARE_FILES), packages/vite/src/app/routes, packages/lumiose/src/app/server/handler.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A folder middleware.ts runs for the pages, form actions and endpoints below its folder, after the root middleware and outermost first, and for nothing else
- [x] #2 ctx.route is the matched pattern in every middleware, and folder middleware types ctx.params by its folder
- [x] #3 Behaviour on static and prerendered routes is defined, and misuse gets a diagnostic
- [x] #4 lumiose routes lists each route's middleware chain
- [x] #5 Tests cover order, scoping, actions, endpoints, groups and optional segments
- [x] #6 concepts/server.md, concepts/routing.md, reference/app.md and the Coming from guides are updated
- [x] #7 src/routes/middleware.ts is a LUM5002 error that points to src/middleware.ts
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m10-97578d (M10 batch 1).

Nova (2026-10-15), implementation:
- Route scanner: `middleware.ts`/`middleware.js` is a route file kind (segments.ts); `middleware.tsx`/`.stsx` and `src/routes/middleware.ts` are LUM5002 (the latter points to src/middleware.ts); two in one folder are LUM5003. The manifest gains `middleware: MiddlewareEntry[]` ({ file, dir, pattern }) and each page and endpoint an optional `middleware` list (outermost first, absent when empty, so existing manifests and JSON stay the same).
- Handler: `ctx.route` = matched pattern (undefined for unmatched URLs, also on the prerender context). After the locale checks, `dispatch` wraps `serveRoute` in the folder chain (`runMiddlewareFiles`), unguarded while prerendering like src/middleware.ts, the route itself guarded again. Errors thrown in folder middleware propagate to `handle` (error page / endpoint error outside the chain). No folder middleware = one `undefined` check per request.
- Types: `RequestContext.route` (`Routes | undefined`, or `P`); `Middleware<P extends LayoutRoutes = never>`: with P, ctx.params = the folder params (`LayoutParams<P>`, shared with LayoutProps) and ctx.route = `RoutesBelow<P>` (patterns equal to P or below `${P}/`; a group folder at "/" gets all routes). Typegen adds middleware-only folders to LayoutMap, so no new public map. Internal type helpers `LayoutParams`, `RoutesBelow` (registry.ts, not exported from lumiose).
- New diagnostic LUM5008 (warning, registry.rs one line in Photon area, errors/LUM5008.md): folder middleware covering prerendered routes (static pages/endpoints, spa pages with prerender), once per middleware file with up to 3 patterns listed; shown by lumiose check, lumiose routes, the dev log and the build log.
- Build: middleware files are server-entry modules and get route chunk names (`admin-middleware`).
- `lumiose routes` (packages/cli, Beacon area, small edit flagged to Lux): `middleware` in JSON (full chain incl. src/middleware.ts) and a MIDDLEWARE column (`a > b`) when any route has one.
- Docs: concepts/server.md (Folder middleware section, example, mistakes), concepts/routing.md, reference/app.md, reference/cli.md, reference/mcp.md, guides/auth.md, errors/LUM5002.md, errors/LUM5008.md, llms regenerated. Coming from: coming-from-react.md has no middleware mapping; the React Router and Next.js guides are Beacon in-flight work (TASK-302/303, not in main) that still describe folder middleware as missing: hand-over written to the run notes for Lux/Beacon.
- Tests: segments/manifest (kinds, chains with groups and optional segments, LUM5002/5003/5008), server/middleware.test.ts (order, scoping, unmatched URLs, actions, endpoints, groups, optional segments, locals and headers, errors, i18n, prerendering, ctx.route in root middleware/endpoints/actions), typegen (LayoutMap + TS 7 type test of Middleware<P>), cli routes, build (server entry + prerender + LUM5008 log).
- Checks: vitest lumiose/src/app, vite/src/app, cli, apps/web content: 686+ passed; typecheck lumiose/vite/cli clean; oxlint clean on touched files; docs:check green; cargo test lumiose_compiler diagnostics ok.

Nova (2026-10-15), follow-up after pnpm check: `RequestContext.route` is `Routes | undefined` whatever `P` is. Typing it as `P` made TypeScript measure `RequestContext` as covariant in `P`, so `RequestContext<"/logout">` no longer passed to helpers taking `RequestContext` (benchmarks/fullstack/apps/lumiose failed `lumiose check`). `Middleware<"/folder">` keeps the narrowed `ctx.route` (its own context type). Regression type test in typegen.test.ts; docs (routing.md, reference/app.md) say so. Also: `route` assignments in handler.ts cast like `locale`, for apps whose RouteMap is generated.

Nova (2026-10-15, batch 2): Coming-from guides updated after Beacon's guides merged: react-router.md, nextjs.md (mapping rows, no-equivalent rows, examples) and solid.md (middleware row).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Folder `middleware.ts` (and `.js`) runs for the pages, form actions and endpoints below its folder, group folders included, after src/middleware.ts and the locale checks, outermost first; `ctx.route` is the matched pattern everywhere and `Middleware<"/folder">` types params and route. src/routes/middleware.ts is LUM5002; middleware covering prerendered routes is the new LUM5008 warning (check, build, dev log). `lumiose routes` prints each chain. Docs and tests updated; the in-flight React Router/Next.js Coming-from guides need a follow-up row change (hand-over noted).
<!-- SECTION:FINAL_SUMMARY:END -->
