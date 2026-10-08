---
id: TASK-21
title: 'Implement file routes, route modes and typegen'
status: In Progress
assignee:
  - '@Nova'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 12:28'
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
- [ ] #1 Scans src/routes (index, [param], [...rest], (group), _layout, _404, _error, endpoints) into a manifest with inherited modes; LUM5002/5003
- [ ] #2 Typegen writes .lumen/types with typed params, RouteProps<'/path'> and href()
- [ ] #3 Unit tests
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
