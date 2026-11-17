---
id: TASK-614
title: '/ui: a gallery of every component, live, and the component page layout'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-11-17T12:29:00Z'
labels: []
milestone: m-16
dependencies:
  - TASK-604
  - TASK-613
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 606000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rebuild the /ui section to the reference: the index is a grid of every @lumiose/ui component as a live demo, each cell linking to its page; a component page shows a large preview, usage and a props table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The index lists every component exported by @lumiose/ui, generated from the package so new components appear without hand edits
- [ ] #2 Each demo on the index is interactive and each cell links to its component page
- [ ] #3 A component page shows the preview first, then usage beside the props table
- [ ] #4 ui docs:check and the ui e2e and a11y suites pass
<!-- AC:END -->
