---
id: TASK-74
title: Island refs and the island manifest for modules outside the Vite root
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 16:37'
updated_date: '2026-10-08 21:20'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59), whose SiteHeader uses <SiteNav client:load> and <ThemeToggle client:load>, and CodeBlock <CopyButton client:visible>. When apps/web (TASK-57) renders them, the islands' modules are outside the app's Vite root (packages/site-kit/src).

1. The compiler gives such islands absolute filesystem refs: compile(SiteHeader.stsx, { root: apps/web }) yields ref '/Users/<user>/…/packages/site-kit/src/SiteNav.stsx#SiteNav' (and module). These refs end up in server-rendered island records (HTML), so builds leak machine paths and differ between machines.
2. The manifest scan (packages/lumen/src/vite/islands.ts) compiles every Lumen module under the project root only; call sites in linked workspace packages are found only when a client transform reports them, so a production client build (built before the server graph) can miss them.

Not verified end to end: hydration is still being built (TASK-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Islands in modules outside the Vite root get stable, machine-independent refs (e.g. package-relative or /@fs-free ids) that the loader can import in dev and build
- [x] #2 The client manifest of a build includes island call sites in linked workspace packages (e.g. @lumen/site-kit's SiteNav, ThemeToggle, CopyButton), covered by a plugin test
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Design (Lux: no absolute build-machine paths in HTML; stable package-relative ids):
1. Compiler: CompileOptions.packages [{ name, dir }] (napi + d.ts). A module's stable id: '/src/x.stsx' inside root (unchanged), '<package name>/<path in package>' inside the innermost listed package ('@lumen/site-kit/src/SiteNav.stsx', the same string as a deep import), else the id as given. Island refs and scope tokens use it; IslandMeta.module stays importable (root-relative or the absolute file) for the manifest's import(), so only build-time code sees the path (Rollup replaces it with a chunk).
2. lumen/vite: packages.ts finds the nearest named package.json of files outside root (cached) and the root package's linked dependencies that depend on lumen (transitively, real path not excluded). Every compile (transform, style load, hot update, scan) passes the same packages, so JS and CSS scope tokens agree.
3. The one-time scan (islands + CSS manifest) covers root plus those linked package dirs, so a client build's manifest (and its stylesheets) include call sites in e.g. @lumen/site-kit.
4. Tests: compile_api (refs, module, scope tokens with packages); plugin test with a linked workspace package (SSR ref + client build manifest chunk). Docs: islands/vite pages.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-08): implemented in 1206b5b + 4c35919.
- Compiler: CompileOptions.packages [{ name, dir }] (napi PackageRoot, index.d.ts). New crate::module_id: stable ids are '/src/x.stsx' inside root (unchanged), '<name>/<path in package>' inside the innermost listed package (same string as a deep import), else the id as given. Island refs AND scope tokens use them (scope tokens of outside-root modules hashed absolute paths, so CSS/HTML also differed between machines). IslandMeta.module stays importable (root-relative or absolute) for the manifest; bundling replaces it with a chunk, so only refs reach HTML. Relative island imports now resolve against the absolute file (previously '..' above the root was clamped).
- lumen/vite: packages.ts. Per compiled file outside root: its nearest named package.json. Linked packages: the root's nearest package.json dependencies (all four fields) resolved through node_modules to real paths, kept when the package lists 'lumen' as a dependency, its real path is not excluded and not inside root; transitively. All compiles (transform, style load, hot update, scan) get the same list, so JS and CSS scope tokens agree. The one-time scan covers root + linked package dirs, so the client build's island manifest AND CSS manifest know their call sites/stylesheets.
- Tests: module_id unit test; compile_api islands_and_scope_tokens_outside_the_root_are_package_relative (refs, modules, bare specifiers, cross-package relative import, scope token, fallback without packages); plugin.test.ts fixture now has app/ + a linked workspace package kit/ (@acme/kit, node_modules/@acme/kit symlink): dev manifest found by the scan before any kit module is transformed, served via /@fs, SSR ref '@acme/kit/src/Nav.stsx#Nav', JS/CSS scope tokens equal, and the client build has a Nav chunk keyed by the stable ref with no temp path in the manifest chunk.
- Docs: concepts/islands.md 'Islands from other packages'; llms regenerated.
Limits: islands of installed (non-linked) dependencies are out of scope (node_modules is excluded from compilation by default); a scanned package is scanned whole (e.g. site-kit's showcase/ too), which can only add unused chunks. Not verified end to end in a browser with apps/web (it does not exist yet; TASK-57).
Validation: cargo test -p lumen_compiler, clippy (lumen_compiler, lumen_napi) 0 warnings, fmt; pnpm test 922 passed; pnpm --filter lumen/@lumen/compiler typecheck OK (pnpm typecheck fails only in untracked examples/ssg-travel-journal: no tsconfig, someone else's WIP); pnpm lint exit 0 (warnings only in app/router).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Island refs of modules outside the Vite root are now package-relative (@lumen/site-kit/src/SiteNav.stsx#SiteNav) instead of absolute build-machine paths, and scope tokens of such modules hash the same stable id. lumen/vite passes the packages to every compile and its one-time scan covers the root's linked dependencies that use lumen, so a client build's island manifest (and CSS manifest) include call sites in workspace packages. Covered by compiler and plugin tests (dev manifest, /@fs import, SSR ref, scope tokens, client build chunk).
<!-- SECTION:FINAL_SUMMARY:END -->
