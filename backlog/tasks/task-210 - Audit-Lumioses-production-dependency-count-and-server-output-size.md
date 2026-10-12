---
id: TASK-210
title: Audit Lumiose's production dependency count and server output size
status: Done
assignee:
  - Lux
created_date: '2026-10-10 22:41'
updated_date: '2026-10-12 13:24'
labels:
  - size
  - positioning
milestone: m-7
dependencies: []
priority: medium
ordinal: 212000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the fullstack benchmark counts 139 production dependency packages for the Lumiose app against 81 (React Router) and 28 (Next.js), and 168 kB of server output against React Router's 72 kB. Find what pulls them in (for example build-time packages in dependencies), fix what is misplaced, and record what remains and why.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The production dependency tree of the benchmark app is explained package by package group
- [x] #2 Misplaced dependencies are moved, and the fullstack 'other' metrics are rerun and committed
- [x] #3 The server output size is explained, with any reductions made
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (2026-10-11), audit:
- Production dependencies. The 139 came from results taken at 61f0be6, 46f3030 and b836aa8 (all 2026-10-09), before TASK-39 split the tooling (vite, svgo, MCP SDK, zod and so on) out of lumiose into @lumiose/vite and @lumiose/cli. Today the benchmark app's production tree, counted the way the harness's dependencyCount does it, is 4 packages: @bench/data and @bench/ui-css (the benchmark's shared workspace packages, also used by the other apps), @lumiose/adapter-node and lumiose (which has no dependencies). React Router is 81 and Next.js 28 on the same count. Nothing is misplaced, so nothing moves.
- Server output. dist/server is 124.9 kB today (168 kB at b836aa8). About 70 kB of it is the Lumiose runtime: the scope chunk (reactive core and server renderer, 36 kB) and the app chunk (request handler, 34 kB). By design, the build bundles the runtime and the linked workspace packages into the server output (concepts/rendering-modes). React Router's 72 kB build/server leaves React out: it loads at least 326 kB from node_modules at runtime (react-dom/server production 301 kB, react 18 kB, react-router 7 kB entry). So the metric compares different accounting, and there is no defect to reduce. If the landing ever shows server size, it should count the output plus the production dependencies' runtime code.
- Remaining: rerun the fullstack 'other' group (and the build group) on a quiet machine, so the committed results show the current counts. Lux does it in the measurement wave.

Lux 2026-10-12: 'other' and build groups rerun in results/2026-10-12T114559-macbookpro.json (fd2723b): Lumiose runtime deps 2 (was 139 before TASK-39), dist/server 130 kB (React Router 72 kB without React, SvelteKit 1.5 MB, Next 7.2 MB).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit done: Lumiose's production tree is 2 runtime packages after TASK-39, server output ~130 kB, about 70 kB of it the bundled runtime by design. Current numbers committed in the 2026-10-12 run.
<!-- SECTION:FINAL_SUMMARY:END -->
