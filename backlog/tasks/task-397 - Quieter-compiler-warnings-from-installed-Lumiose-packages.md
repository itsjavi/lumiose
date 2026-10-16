---
id: TASK-397
title: Quieter compiler warnings from installed Lumiose packages
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
ordinal: 396000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Photon in TASK-390 (2026-10-15): now that @lumiose/vite compiles Lumiose packages in node_modules, their compiler warnings (for example LUM2001, TASK-391) reach every app that installs them. Decide whether warnings from installed packages are shown, summarized or hidden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Warnings from installed packages follow a recorded policy, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): done in 11803f57. The policy (orchestrator-delegated) is "summarized":

- **Installed packages.** Compiler warnings in the files of a Lumiose package installed in node_modules (`Packages.installedOf`) are not shown one by one; the package's author fixes them, not its users.
  - In `lumiose dev`, the first warning of each package logs one line: "<pkg> (installed) has compiler warnings in its files (<first code> first); they are the package's to fix, so @lumiose/vite does not show them."
  - A build ends (buildEnd of the last environment) with one line per package: "<pkg> (installed): N compiler warnings in its files (LUM2006 ×2, …), not shown; they are the package's to fix."
  - Each warning counts once across the client and server compiles: the key is file, offset and code.
- **Linked packages** (workspace, link:) are being worked on, so their warnings show like the app's.
- **Errors** always show.
- Style warnings from the CSS module's load (`reportFromLoad`) follow the same route.

Tests (plugin.test.ts):
- dev: an installed package's two LUM2006 warnings, compiled for the client and the SSR, give one line; a linked package's show as two.
- build: the summary line with "LUM2006 ×2".

Docs: reference/vite.md, Lumiose packages ("Their warnings stay theirs"). llms-full regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Warnings from installed Lumiose packages are summarized per package (once in dev, a line per package at the end of a build); linked packages' show; tests and docs (11803f57). Checks: pnpm check (2372 tests), pack:check --smoke --skip-npm (@lumiose/ui 146 files), ui-e2e Chromium 728 passed (22 skipped), Linux Firefox and WebKit 729 passed (21 skipped), apps/web 179 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
