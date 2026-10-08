---
id: TASK-74
title: Island refs and the island manifest for modules outside the Vite root
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:37'
labels: []
milestone: m-5
dependencies: []
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59), whose SiteHeader uses <SiteNav client:load> and <ThemeToggle client:load>, and CodeBlock <CopyButton client:visible>. When apps/web (TASK-57) renders them, the islands' modules are outside the app's Vite root (packages/site-kit/src).

1. The compiler gives such islands absolute filesystem refs: compile(SiteHeader.stsx, { root: apps/web }) yields ref '/Users/<user>/…/packages/site-kit/src/SiteNav.stsx#SiteNav' (and module). These refs end up in server-rendered island records (HTML), so builds leak machine paths and differ between machines.
2. The manifest scan (packages/lumen/src/vite/islands.ts) compiles every Lumen module under the project root only; call sites in linked workspace packages are found only when a client transform reports them, so a production client build (built before the server graph) can miss them.

Not verified end to end: hydration is still being built (TASK-18).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Islands in modules outside the Vite root get stable, machine-independent refs (e.g. package-relative or /@fs-free ids) that the loader can import in dev and build
- [ ] #2 The client manifest of a build includes island call sites in linked workspace packages (e.g. @lumen/site-kit's SiteNav, ThemeToggle, CopyButton), covered by a plugin test
<!-- AC:END -->
