---
id: TASK-21
title: 'Implement file routes, route modes and typegen'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 12:37'
labels: []
milestone: m-3
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every app mode is driven by the file-route manifest, and typed routes give agents compile errors for broken links (spec §7.1, §8).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Scans src/routes (index, [param], [...rest], (group), _layout, _404, _error, endpoints) into a manifest with inherited modes; LUM5002/5003
- [x] #2 Typegen writes .lumen/types with typed params, RouteProps<'/path'> and href()
- [x] #3 Unit tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. app/diagnostics.ts: structured {code, severity, message, file, help?} diagnostics (LUM5002/LUM5003).
2. app/routes/segments.ts: parse a routes-relative file path into kind (page .stsx/.tsx | endpoint .ts | layout | 404 | error) and URL segments (static, [param], [...rest], (group) transparent, index collapses, dots kept for endpoints like sitemap.xml.ts); invalid names -> LUM5002.
3. app/routes/meta.ts: readRouteModuleMeta(source) reads export const mode/ssr with a comment-aware regex (swappable for compiler module meta later).
4. app/routes/manifest.ts: createRouteManifest(entries) (pure) builds pages/endpoints with pattern, params, file, layout chain, nearest _error/_404, resolved mode (own export > nearest layout > static) and ssr; duplicates -> LUM5003; routes sorted by priority. app/routes/scan.ts: scanRoutes(root) walks src/routes and feeds it.
5. app/routes/match.ts: createRouteMatcher(manifest) with static > param > rest priority, groups transparent, rest matches zero+ segments, plus notFound(pathname) lookup.
6. app/routes/href.ts: runtime href(pattern, params) + augmentable RouteMap registry, Routes, RouteParams, RouteProps types; export from app/public.ts and app/public.server.ts.
7. app/typegen: generateRouteTypes(manifest) -> .lumen/types/routes.d.ts (declare module "lumen" { interface RouteMap {...} }), writeRouteTypes(root) writes only on change.
8. Vitest unit tests with __fixtures__ route trees, including a tsc --noEmit check of generated types on a temp usage file; run pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova: implemented in packages/lumen/src/app/{diagnostics.ts,routes/*,typegen/*} and exported href + route types from app/public.ts and app/public.server.ts.

Decisions (routine, flag if you disagree):
- src/routes is strict: every .stsx/.tsx (page) and .ts (endpoint) file is a route, except *.test.*/*.spec.*, *.d.ts and dot files/folders; other extensions are ignored. _-prefixed files other than _layout/_404/_error are LUM5002 (helpers belong outside src/routes); _layout/_404/_error must be page files.
- [...rest] matches zero or more segments, value is a string joined with "/" ("" when empty), and must be the last URL segment. Optional [[x]], mixed segments (post-[id], [slug].json.ts), invalid param names and duplicate param names are LUM5002.
- Mode: own export > nearest layout's > static. Endpoints inherit too but are static|server only: an inherited spa serves them as server; mode = "spa" on an endpoint is LUM5002. ssr inherits from layouts and only takes effect on spa routes; ssr = false on a non-spa file is a LUM5002 warning. Invalid or non-literal mode/ssr exports are LUM5002 and fall back to inheritance.
- Duplicates (same URL ignoring groups and param names, page vs endpoint included, and duplicate _layout/_404/_error per folder): first file in path order wins, the rest are dropped with LUM5003.
- Matcher priority is lexicographic per segment: static > [param] > [...rest], and an exact route beats a trailing rest. notFound(pathname) picks the _404 with the deepest matching folder scope.
- Typed routes use module augmentation: .lumen/types/routes.d.ts declares module "lumen" { interface RouteMap { "/blog/[slug]": { kind: "page"; params: { slug: string } } } }. Routes falls back to string before typegen. Endpoints are included in Routes/href.
- mode/ssr are read by readRouteModuleMeta (comment/literal-aware regex), injectable via createRouteManifest({ readMeta }) for the compiler's module meta later.

Open questions: endpoints default to static, so an endpoint with POST and no mode is static (TASK-26 should flag non-GET handlers on static endpoints). href() does not apply Vite base/trailingSlash yet (TASK-24/26).

Validation: pnpm typecheck OK, pnpm lint OK (0 errors; only pre-existing empty-export warnings in stubs), pnpm test 89/89 (app layer: 7 files, 87 tests). typegen.test.ts copies the fixture into a temp dir, runs typegen and tsc 7 --noEmit on a usage file with exact Routes/RouteParams assertions and @ts-expect-error broken links.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented file routes and typegen in packages/lumen/src/app. scanRoutes/createRouteManifest turn src/routes (index, [param], [...rest], (group), _layout, _404, _error, endpoints such as sitemap.xml.ts) into a typed manifest: pattern, params, file, kind, layout chain, nearest _error/_404, and resolved mode/ssr (own export > nearest layout > static). It reports LUM5002 (invalid route file or mode export) and LUM5003 (duplicate route) as {code, severity, message, file, help}. createRouteMatcher matches URLs with static > param > rest priority and finds the nearest _404. typegen() writes .lumen/types/routes.d.ts, which augments lumen's RouteMap so Routes, RouteParams, RouteProps<'/blog/[slug]'> and href() are typed. The runtime href() is exported from lumen. Verified with 87 Vitest tests over fixture trees, including a TS 7 tsc --noEmit check of the generated types, plus pnpm typecheck/lint/test.
<!-- SECTION:FINAL_SUMMARY:END -->
