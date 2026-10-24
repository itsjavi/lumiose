---
id: TASK-563
title: 'Router docs: unsaved changes recipe for beforeNavigate'
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-24 15:39'
labels:
  - docs
  - router
dependencies: []
priority: medium
ordinal: 555000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Lux's request (2026-10-24): add a short Unsaved changes recipe where the router docs cover beforeNavigate, for 0.7.0's semantics (decision-50 amendment, TASK-549): cancel every navigation while the page has unsaved work, show your own dialog for link/navigate with navigation.to.url, let the browser prompt for leave; a Leave button that sets a flag and navigates (location.assign on MPA pages, navigate() in an SPA). Docs only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 reference/router.md has an Unsaved changes recipe with a type-checked example for MPA islands and SPAs, linked from concepts/routing.md
- [ ] #2 docs:gen output is current; docs:check, the docs tests and typecheck pass
<!-- AC:END -->
