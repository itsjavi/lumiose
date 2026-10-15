---
id: TASK-391
title: LUM2001 warning in Dialog.Popup's server-only content
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 17:52'
labels:
  - ui
  - diagnostics
milestone: m-12
dependencies: []
priority: low
ordinal: 390000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seen in the local showcase (2026-10-15): every dev compile of packages/ui/src/dialog/dialog.tsx warns LUM2001 at `const content = isServer ? children : undefined;` (Dialog.Popup), in the server and client environments. Either restructure the code so the intent (server renders the children, the browser claims the dialog first) needs no warning, or, if the warning is a false positive for isServer-guarded values, record that and route a compiler fix to Photon.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compiling dialog.tsx reports no LUM2001, in dev and build
- [ ] #2 Dialog's hydration and doc-9 checks still pass
<!-- AC:END -->
