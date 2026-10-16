---
id: TASK-398
title: Type-check .stsx files of installed Lumiose packages
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
ordinal: 397000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): .stsx files in installed packages have no shadow files, so `lumiose check` cannot type-check apps against them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `lumiose check` type-checks an app that imports .stsx components from an installed package
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): done in db09fc6f.

- **Layout.** `shadowLayout` (packages/vite/src/layout.ts) now counts installed Lumiose packages (`Packages.installed()`) with the linked ones.
  - They sit in the root's node_modules, inside the mirror base, so they never move it.
  - With the generated tsconfig (the template extends it), their `.stsx` files get shadows below `.lumiose/shadow/node_modules/…`. TypeScript reaches those through rootDirs from the package's real path (pnpm's `.pnpm/…` included), as for linked packages.
  - With a tsconfig whose rootDirs pair `src` only, they are `outside`, and `lumiose check` warns as for a linked package.
- **Test.** check/layout.test.ts "type-checks .stsx modules of installed packages (TASK-398)": `@acme/ui` in pnpm's layout, and an app whose bad prop type is reported at src/App.stsx:4. It fails without the change. The cli (114), vite (222) and language-server (59) tests pass.
- **Limitation (documented in reference/jsx.md).** A shadow resolves bare imports from where it sits, so a package's `.stsx` that imports one of its own dependencies by name type-checks only where that dependency is hoisted into the project's node_modules (npm, Yarn, Bun), not with pnpm's isolated layout. `lumiose` itself (a peer, the app's dependency) resolves.
- **Orphans.** Shadows of a removed installed package stay until `.lumiose` is cleared: the orphan sweep skips node_modules folders. They are harmless.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Installed Lumiose packages' .stsx files are shadowed under the generated tsconfig, so lumiose check type-checks apps against them; test and docs, with the pnpm limitation for their own bare imports (db09fc6f). Checks: pnpm check (2372 tests), pack:check --smoke --skip-npm (@lumiose/ui 146 files), ui-e2e Chromium 728 passed (22 skipped), Linux Firefox and WebKit 729 passed (21 skipped), apps/web 179 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
