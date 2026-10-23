---
id: TASK-549
title: 'Router: beforeNavigate reports link clicks on MPA pages'
status: To Do
assignee:
  - Spark
created_date: '2026-10-23 22:12'
labels:
  - router
  - dx
dependencies: []
priority: medium
ordinal: 541000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's forms, actions and auth slice (2026-10-24). On MPA pages (static and server routes), beforeNavigate only reports "leave". Repro: on a server page, an island with unsaved state calls `beforeNavigate((n) => n.cancel())`; clicking a plain `<a href="/other">` only shows the browser's generic Leave site? prompt, and no `type: "link"` call comes, so the app cannot show its own dialog. The port's workaround: a capture-phase document click listener that repeats the link checks (modifier keys, target, download, origin, path). Suggestion: on MPA pages, report same-origin link clicks as "link" with `willUnload: true`, and make cancel() prevent the click.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On MPA pages, a same-origin link click calls beforeNavigate with type "link" (willUnload true) and cancel() keeps the page; modified clicks, target and download links are left to the browser
- [ ] #2 Tests cover it; the router docs describe beforeNavigate on MPA pages
<!-- AC:END -->
