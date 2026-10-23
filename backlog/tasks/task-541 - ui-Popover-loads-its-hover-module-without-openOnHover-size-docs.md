---
id: TASK-541
title: 'ui: Popover loads its hover module without openOnHover; size docs'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 21:57'
labels:
  - ui
  - performance
dependencies: []
priority: low
ordinal: 534000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's @lumiose/ui pass (2026-10-23). The Popover script loads `hover.ts` (0.7 kB brotli) even when no trigger uses `openOnHover`. The docs say 3.3 kB; the port measured 4.0 kB across 4 chunks. The docs also say the scripts are bundled into islands, but they load as separate modules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 hover.ts loads only for a trigger with openOnHover (or the docs say why it cannot)
- [x] #2 The documented sizes and loading match what a build ships
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (commit 1505dcbd). Fix: the hover timing moved out of popover.script.ts into a new internal client script, popover/popover-hover.script.ts (hover.ts and Popover's hover source), which Popover.Trigger loads only with openOnHover and which hands the timing to popover.script.ts (useHover). A dynamic import() was tried first and dropped: Vite wraps it in its preload helper (a 0.32 kB chunk) and a module namespace, which ate most of the saving. Real build (examples/ui-e2e): a page with popovers and no hover trigger loads 3.2 kB brotli in 3 files (was 3.9 kB in 4); with a hover trigger 4.1 kB in 5. In islands a ?client import is static, so an island that imports popover.tsx still loads the hover script. Sizes and loading: pnpm --filter @lumiose/ui size now builds the client scripts together, as an app's client build does, and adds up the files a page loads, each compressed on its own (plus a 'popover, openOnHover' row); every component page's sizes now come from it (several rose, as shared modules are separate files: Menu 4.4 kB, Combobox 5.8 kB, Tooltip 2.1 kB, Navigation Menu 4.0 kB, Preview Card 3.4 kB), and the pages say an island loads the same modules instead of 'islands bundle it'. Tests: ui-e2e popover-hover-modal.e2e.ts (dev and build: /popover loads no hover module, /popover/hover-modal does) and the exact script lists of the popover, tooltip and hover-modal pages (fail without the fix).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Popover's hover timing loads only for a trigger with openOnHover (a separate client script); the ui docs' sizes and loading match a real build, from a size script that measures as the build ships.
<!-- SECTION:FINAL_SUMMARY:END -->
