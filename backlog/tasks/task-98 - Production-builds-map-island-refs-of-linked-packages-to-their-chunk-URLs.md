---
id: TASK-98
title: Production builds map island refs of linked packages to their chunk URLs
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 21:51'
updated_date: '2026-10-08 22:01'
labels:
  - bug
  - build
dependencies: []
priority: high
ordinal: 98000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon while building apps/web (TASK-57). Islands from a linked workspace package (@lumen/site-kit SiteNav, ThemeToggle) hydrate in a lumen build, but every page also gets <link rel=modulepreload href="@lumen/site-kit/src/SiteNav.stsx"> (a 404): islandUrls() in packages/lumen/src/app/production/build.ts only maps chunks inside the root (path not starting with ../), while TASK-74 names modules of linked packages package-relatively. Map those chunks under the same package-relative specifier (the CompileOptions.packages naming).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Island chunks of linked packages map to their built URLs; no modulepreload or island URL uses a bare package-relative ref
- [x] #2 Covered by a build test with a linked package island
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Map each island ref's module to the chunk the island manifest loads it from, by resolving the manifest's import (exact for root-relative, package-relative and bare refs); expose the island registry's ref module -> import specifier pairs on the lumen plugin api; same lookup for dev URLs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: assigned to Nova (islandUrls in app/production/build.ts is Nova's), since TASK-74 (Photon) names linked-package chunks package-relatively. Do it after TASK-93/94.

Nova: reproduced with a fixture (kit package linked into an app): refs '@acme/kit/src/Nav.stsx#Nav' (call site in the package) AND '@acme/kit#Nav' (app imports the island by the package's bare name) both got <link rel=modulepreload href> equal to the ref, a 404, in builds and dev.
Fix:
- lumen/vite (minimal, Photon's files): IslandRegistry.modules() and LumenPluginApi.islandModules(): the module of each ref -> the specifier the island manifest imports it with (root-relative, absolute id, or bare).
- lumen build (app/production/plugin.ts): the client environment's post generateBundle resolves each specifier with this.resolve(spec, ISLANDS_ID), as the build did, and finds the chunk: the dynamic entry whose facade it is, else the chunk containing it (a package index that re-exports the island pulls it into its chunk). build.ts adds these to the island URLs after islandUrls (which still maps root-relative dynamic entries, for SPA modules).
- lumen dev (app/dev/plugin.ts): package-relative refs -> /@fs/<absolute id>(?import), the same URL Vite writes for the manifest's import; bare refs -> /@id/<name> (served, no 404; the manifest imports the resolved file, so that preload is not reused: acceptable for dev).
- An earlier, unclaimed parallel attempt (app/island-modules.ts reproducing the compiler's naming with Packages and the default exclude) appeared in the tree while I worked and was reverted by its author; this approach needs no naming copy and also covers bare refs.
Evidence: build.test.ts 'maps the islands of linked packages to their chunks' (package-relative and bare refs; both preloads are built chunks that exist; the server entry carries the URLs). apps/web built to a scratch outDir: 111 files prerendered, every modulepreload (SiteNav, ThemeToggle, src index chunk) exists, none bare. Dev: fixture pages preload /@fs/.../kit/src/Nav.stsx?import (200, identical to the manifest's import) and /@id/@acme/kit (200). pnpm typecheck, pnpm lint (0 errors), pnpm test (99 files, 1001 tests), docs:check; travel-journal e2e 15/15, bookshelf e2e 14/14. Docs: concepts/islands.md (bare-name refs; preloads in build and dev).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Islands of linked packages (package-relative refs) and islands imported by a package's bare name now preload their built chunk instead of a 404 bare URL. lumen/vite exposes the island registry (ref module -> manifest import) as api.islandModules(); lumen build resolves each import like the build did and maps it to the chunk that holds the module; lumen dev maps them to /@fs/ or /@id/ URLs. Build test, apps/web build (111 pages, no bad preloads), sample e2e green.
<!-- SECTION:FINAL_SUMMARY:END -->
