---
id: TASK-489
title: >-
  Dotmatrix: deploy the apps to GitHub Pages at /dotmatrix/, /dotmatrix/react/
  and /dotmatrix/advanced/
status: To Do
assignee:
  - '@Chime'
created_date: '2026-10-20 21:22'
updated_date: '2026-10-20 23:42'
labels: []
milestone: m-13
dependencies:
  - TASK-488
priority: medium
ordinal: 485000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-73 (revised 2026-10-21): one Pages deployment of itsjavi/dotmatrix with pocket at /dotmatrix/, pocket-react at /dotmatrix/react/ and advanced at /dotmatrix/advanced/. Each app builds with its base; the root 404.html hands deep links below /react/ and /advanced/ to that app's SPA shell (the approach of the Lumiose site's scripts/site.ts). pocket-react joins when TASK-491 lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A push to main deploys pocket at /dotmatrix/ and advanced at /dotmatrix/advanced/
- [ ] #2 Deep links and share links (?song=) work in each app, including after a reload
- [ ] #3 pocket-react is served at /dotmatrix/react/ once TASK-491 lands
<!-- AC:END -->
