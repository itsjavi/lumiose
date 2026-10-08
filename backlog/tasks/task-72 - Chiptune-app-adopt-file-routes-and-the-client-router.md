---
id: TASK-72
title: 'Chiptune app: adopt file routes and the client router'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 16:26'
labels: []
milestone: m-6
dependencies:
  - TASK-35
  - TASK-25
priority: low
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-35 ships the chiptune app as a client-only app switching views via state. Once the SPA router exists, it should use lumen({ mode: 'spa', ssr: false }) with file routes, as the sample is meant to show.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Views become src/routes/* with a persistent root _layout (transport + mixer stay mounted and keep playing across navigation); deep links to songs; lumen dev/build in spa mode; README updated
<!-- AC:END -->
