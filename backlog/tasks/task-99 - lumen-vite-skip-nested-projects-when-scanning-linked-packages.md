---
id: TASK-99
title: 'lumen/vite: skip nested projects when scanning linked packages'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 21:51'
updated_date: '2026-10-08 21:59'
labels:
  - build
dependencies: []
priority: low
ordinal: 99000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon (TASK-57): the one-time scan of linked Lumen packages (packages/lumen/src/vite/scan.ts) also covers nested projects inside a package, so building apps/web emits packages/site-kit/showcase's Showcase CSS (assets/Showcase-*.css, unused). Skip directories with their own package.json or tsconfig.json below a linked package, as lumen check does (cli/check/shadow.ts listFiles).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A linked package's nested project (site-kit/showcase) is not scanned; apps/web's build has no Showcase asset
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
scan.ts: when walking a linked package's directory, skip subdirectories that are projects of their own (package.json, tsconfig.json or vite.config.*), like lumen check's listFiles; the root scan is unchanged. Plugin test: a nested project inside the linked kit fixture with an island and a style block is not in the client manifest / build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux: assigned to Photon (lumen/vite linked-package scan).

Photon (2026-10-08): b8176c6 + docs 4001899. scan.ts sourceFiles(dir, skipProjects): for linked packages, a subdirectory containing package.json, tsconfig.json or vite.config.{js,ts,mjs,mts,cjs,cts} is skipped (lumen check's rule plus vite.config); the root scan is unchanged. Plugin test: the kit fixture gained showcase/ (tsconfig + an island call site); the dev manifest has no showcase entry (verified the test fails without the fix). Evidence: apps/web 'lumen build' before: dist/client/assets/Showcase-DkwzReFV.css; after: no Showcase asset; site-kit islands (SiteNav, ThemeToggle, CopyButton) still get chunks and the HTML refs are '@lumen/site-kit/src/…#…' with no /Users paths (TASK-74 end to end). vitest src/vite 40/40, typecheck, oxlint clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The linked-package scan of lumen/vite skips nested projects (dirs with package.json, tsconfig.json or vite.config.*), so apps/web's build no longer emits site-kit showcase CSS. Plugin test + islands docs.
<!-- SECTION:FINAL_SUMMARY:END -->
