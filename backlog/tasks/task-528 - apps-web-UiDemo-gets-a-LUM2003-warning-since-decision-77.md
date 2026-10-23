---
id: TASK-528
title: 'apps/web: UiDemo gets a LUM2003 warning since decision-77'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-23 09:31'
labels: []
dependencies: []
priority: low
ordinal: 521000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-523 (decision-77), LUM2003 warns on early returns whose condition reads props. apps/web/src/ui-demos/index.tsx's UiDemo now gets that warning. Restructure it (branch in JSX) or confirm the warning is right and silence it the documented way.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumiose check reports no LUM2003 in apps/web
<!-- AC:END -->
