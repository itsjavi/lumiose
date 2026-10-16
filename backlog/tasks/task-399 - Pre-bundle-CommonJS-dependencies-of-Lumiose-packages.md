---
id: TASK-399
title: Pre-bundle CommonJS dependencies of Lumiose packages
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-16 03:36'
labels:
  - build
milestone: m-12
dependencies:
  - TASK-390
priority: low
ordinal: 398000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): Lumiose packages are kept out of Vite's dependency optimizer, so a CommonJS dependency of such a package is not pre-bundled. Add those dependencies to optimizeDeps automatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Lumiose package with a CommonJS dependency works in dev without user config, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): done in c63cd5df.

- `Packages.commonJsDependencies()` lists each Lumiose package's `dependencies` and `optionalDependencies` that are CommonJS only, as `"<pkg> > <dep>"`.
  - CommonJS only means no `type: "module"`, no `module` field, no `import` condition in `exports`, a `main` that is not .mjs, and not types-only. Other Lumiose packages and Lumiose's own tooling are left out.
  - The plugin adds them to the browser environment's `optimizeDeps.include`. Vite merges them with the user's config.
  - ES-module dependencies are served as they are, and the server environment is untouched.
- Test (plugin.test.ts): `@acme/ui`, installed in pnpm's layout, depends on cjs-dep (CommonJS) and esm-dep (an ES module).
  - The include has "@acme/ui > cjs-dep", not the ES module.
  - The package's module imports cjs-dep from /node_modules/.vite/deps/… and esm-dep from its own file.
- Docs: reference/vite.md now says it is automatic. It used to tell users to add the include by hand.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The browser's optimizeDeps.include names each Lumiose package's CommonJS dependencies ("pkg > dep"); test and docs (c63cd5df). Checks: pnpm check (2372 tests), pack:check --smoke --skip-npm (@lumiose/ui 146 files), ui-e2e Chromium 728 passed (22 skipped), Linux Firefox and WebKit 729 passed (21 skipped), apps/web 179 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
