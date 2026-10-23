---
id: TASK-541
title: 'ui: Popover loads its hover module without openOnHover; size docs'
status: In Progress
assignee:
  - Halo
created_date: '2026-10-23 20:56'
updated_date: '2026-10-23 20:58'
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
- [ ] #1 hover.ts loads only for a trigger with openOnHover (or the docs say why it cannot)
- [ ] #2 The documented sizes and loading match what a build ships
<!-- AC:END -->
