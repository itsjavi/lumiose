---
id: TASK-542
title: 'build: an app emits every @lumiose/ui client script, used or not'
status: Done
assignee:
  - Photon
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:33'
labels:
  - vite
  - ui
dependencies: []
priority: low
ordinal: 535000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). Once @lumiose/ui is a dependency, the build emits all 29 ui client scripts, whether pages use them or not. Pages load only theirs, but the build output grows (the port's precompressed set went from 334 to 439 kB raw).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The build emits only the client scripts some page uses
- [x] #2 A test covers an app that uses one component
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (worktree run for Lux, 2026-10-23). Cause: packages/vite/src/client-scripts.ts (Photon's area): the client build's buildStart emitted every ?client import of the one-time scan as an entry, the Lumiose packages' included, because the server graph that knows which components pages use is built after the client.

Fix (d46b0487): the scan (scan.ts) now records each module's imports and exports with Vite's parseSync (compiled code for Lumiose modules, source for other JS/TS), and the package it belongs to. The new reachable.ts follows them from every project module, by name and through re-exports (named, export *, export * as), to the package modules whose code can run; client-scripts.ts builds the scripts of those and of every project module. The server build gives the others a stub without the build warning. It over-approximates at module granularity (a module that runs builds all its scripts) and gives up, building every script as before, on a package module with a computed import() or import.meta.glob, an unparsable module that runs, or an import of a package source the scan did not read. No change in packages/vite/src/app or packages/ui was needed.

Tests: packages/vite/src/reachable.test.ts (links and reachability forms) and packages/vite/src/client-scripts.test.ts (two lumiose builds: a fixture package with a barrel index whose app uses Menu builds only lu-menu.element; an app using Tabs from the real @lumiose/ui builds only tabs.script instead of 29). Both fail without the fix. Checked: examples/ui-e2e builds the same 25 script chunks before and after (it uses every component); apps/web builds, its 258 prerendered pages reference only existing scripts, and no page warned of a missing client script.

b852ec65: the client build resolves imports as the browser does, while pages render with the server's modules, so a package that may resolve differently by environment (exports/imports conditions other than default, import, require, module, module-sync, types, development, production, or a browser field) counts whole: all its scripts are built. @lumiose/ui and site-kit have no such conditions. Tests: packages.test.ts resolvesByEnvironment, client-scripts.test.ts (a browser condition builds all three fixture scripts). Docs: reference/vite.md, Lumiose packages, Scanned with the project. Validation: pnpm check green at 9a0b344b; after b852ec65 the @lumiose/vite suite (249 tests), its typecheck, oxlint, oxfmt --check, docs:check and the docs tests (cli docs/mcp, apps/web content) pass. Cost of the analysis not A/B-measured (one parse per scanned module, about 50 ms for 500 files, and one resolve per import of the project's modules into packages).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The client build now builds only the client scripts of the Lumiose packages' modules that the project's modules can run, instead of every ?client import the one-time scan found (the cause was in packages/vite/src/client-scripts.ts; no change in src/app or packages/ui). The scan records each module's imports and exports (Vite's parseSync), and reachable.ts follows them from the project's modules by name, through re-exports, to the package modules that run; unused scripts get the server's no-op stub without a build warning. It over-approximates per module, counts a package that resolves by environment whole, and builds every script when it cannot follow the imports (computed import() or import.meta.glob in a package module, an unparsable module, an unscanned package source). An app rendering Tabs from @lumiose/ui now builds 1 of the 29 scripts. Tests: reachable.test.ts, client-scripts.test.ts (fixture package with a barrel, real @lumiose/ui, environment conditions), packages.test.ts. examples/ui-e2e builds the same 25 script chunks as before; apps/web's 258 prerendered pages reference only existing scripts. Docs: reference/vite.md.
<!-- SECTION:FINAL_SUMMARY:END -->
