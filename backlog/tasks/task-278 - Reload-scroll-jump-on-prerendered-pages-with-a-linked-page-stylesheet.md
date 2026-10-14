---
id: TASK-278
title: Reload scroll jump on prerendered pages with a linked page stylesheet
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - bug
  - css
  - build
dependencies: []
priority: high
ordinal: 280000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 1. Reloading a scrolled MPA page paints its first frames at the wrong position, then jumps; the user also sees it in other Lumiose projects. Measured with the port's scripts/reload-scroll.ts (30 reloads of / at scrollY 1400, Chromium): Astro 13/30 (1304 → 1400), Lumiose 18/30 (1596, the page end → 1400), Lumiose with its stylesheets inlined 0/30. Moving the island loader after the stylesheets, removing the speculation rules or the View Transitions style changed nothing. Cause: Chrome restores the scroll position early during a reload, from a layout made with the stylesheets loaded so far, and corrects it at load. A page's own CSS over INLINE_LIMIT (4 kB, packages/vite/src/app/production/stylesheets.ts) is linked as a file, so that early layout is the unstyled page. Likely fix: inline a page's own stylesheets whatever their size and keep only the shared prefix as a cached file (or raise the limit), after measuring the bytes on the sample apps.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Reloading a long, scrolled prerendered page paints at the restored position (0 jumps in a reload-scroll measurement on a sample app or the itsjavi.com port)
- [ ] #2 The byte cost of the change is measured on the sample apps and recorded in the task
- [ ] #3 concepts/styles.md (In builds) describes the new rule
<!-- AC:END -->
