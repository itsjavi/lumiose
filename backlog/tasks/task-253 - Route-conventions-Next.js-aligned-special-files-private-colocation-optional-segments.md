---
id: TASK-253
title: >-
  Route conventions: Next.js-aligned special files, private colocation, optional
  segments
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-12 18:40'
updated_date: '2026-10-12 20:21'
labels:
  - router
  - breaking
milestone: m-9
dependencies: []
priority: high
ordinal: 255000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-42 as amended on 2026-10-12: Next.js App Router file conventions only. page.stsx/page.tsx (no index, no flat page files), route.ts endpoints (no other .ts endpoints), layout / not-found / error (replacing _layout / _404 / _error), any other file is colocated and ignored, _-prefixed folders are private, [param], [...rest] (one or more), [[...rest]], [[param]], (group). Unsupported Next.js special files (loading, template, default, global-error, @slot, (.)) are LUM5002. No backwards compatibility: no rename diagnostic, no upgrading section. Breaking and cross-cutting: one owner (Nova) moves every app in the repo (examples, apps/web, benchmarks/fullstack/apps/lumiose, create templates, language server, CLI, docs) with Lux's go-ahead; nothing else runs on those paths meanwhile.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Manifest, matcher, typegen, typed href() and lumiose routes implement decision-42's conventions (page, route, layout, not-found, error, colocation, private folders, optional segments)
- [x] #2 Duplicates (page + route in one folder) stay LUM5003; unsupported Next.js special files are LUM5002; tests cover both
- [x] #3 Docs, create templates, examples, benchmarks and the website use the new conventions; language server and CLI updated; pnpm check green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user amended decision-42 (Next.js conventions only, no compat). Nova owns the whole task including other agents' paths; Lux serializes those paths while it runs.

Nova 2026-10-12: started (session nova-20261012T193255Z-t253).

Nova 2026-10-12, implementation (decision-42 as amended):
- Classification (segments.ts): only page.{stsx,tsx}, route.ts, layout/not-found/error.{stsx,tsx} are route files. A wrong extension (page.ts, layout.ts, route.tsx) and the Next.js files Lumiose lacks (loading, template, default, global-error; route files below @slot or (.)/(..)/(...) folders) are LUM5002 with a help line. Everything else is ignored (colocated); _-prefixed, dot and node_modules folders are private. The scanner reads only route-file candidates and skips private folders.
- Segments: new kinds optional ([[x]]) and optionalRest ([[...x]]); [...x] is now one or more. RouteParam gains `optional`. An optional param that matched nothing is absent from params (Next.js: undefined); typegen emits `x?: string` (RouteMap and LayoutMap).
- Matching: routeVariants() expands a route into its URL shapes (with/without each optional segment), ranked like plain routes (static > param > rest), so /[[lang]]/about competes as /about. Equal shapes inside one route keep the earlier optional param. not-found scopes use the same shapes. Manifest order: by the most specific shape.
- Duplicates (LUM5003): per URL shape; routes without optional segments claim first, so an overlap is reported on the optional route ("already serves \"/docs\""); page + route in one folder get "A folder has either a page or a route.ts endpoint".
- href()/fillPattern: optional segments left out when missing or empty; an empty [...rest] throws. Speculation-rules URLPattern and the SPA reroute regexp handle the new kinds.
- Apps: git mv of every app (examples, apps/web, benchmarks/fullstack/apps/lumiose, create templates, CLI/LS/test fixtures) with relative imports rewritten; apps/web serves /docs from docs/[[...path]] (its index used the empty rest).
- Outside my area, minimal: route path strings in packages/lumiose/src/app/server tests (csp.test.ts committed alone via a temp index so TASK-248 pending csp changes stay theirs), comments in app/router and app/server, vite dev/production comments and the prerender not-found message.
- Evidence: pnpm check green except vite options.test.ts (TASK-248 pending `adapter` option, not mine); node --test scripts 31/31; size cap OK (brotli 9.89 kB); docs:gen/docs:check green; Playwright e2e: spa-router-e2e 26/26 (one test now finds the prefetched page chunk by name), ssg-spa-e2e 17, ssg-travel-journal 17, ssr-bookshelf 16, spa-chiptune 28, spa-dotmatrix 66, apps/web 64 (3 skipped). Rust unchanged: cargo test not run.
- Follow-ups: TASK-259 (evals still use the old names; Quasar area, edit only), TASK-260 (every page chunk is now page-[hash].js; name route chunks after their folder).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Route files follow the Next.js App Router conventions only (decision-42 as amended): page.stsx/page.tsx and route.ts are the only page and endpoint files; layout, not-found and error replace _layout, _404 and _error with nearest-wins semantics; any other file in src/routes is colocated and ignored, and _folders are private. Adds [[param]] and [[...rest]], with [...rest] now one or more segments; matching ranks each URL shape of an optional route, typegen and href() handle optional params. page + route in one folder and optional overlaps are LUM5003; the unsupported Next.js special files and folders are LUM5002. Every app in the repo, the create templates, the CLI (routes hint, generated AGENTS.md and skill), the language server and the docs (routing, LUM5002/LUM5003 and every route path mention) moved. Commits: 0a459fd, a7ecc4d, 64f5d99, e96907d, 5b19898, a9e2b12. Follow-ups: TASK-259 (evals), TASK-260 (chunk names).
<!-- SECTION:FINAL_SUMMARY:END -->
