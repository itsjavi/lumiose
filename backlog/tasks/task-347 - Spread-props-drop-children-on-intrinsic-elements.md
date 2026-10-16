---
id: TASK-347
title: Spread props drop children on intrinsic elements
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-16 00:41'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike (removed in TASK-363; it remains in the git history). `<button {...props} />` renders no children when props.children is set; React and Solid render them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A spread that carries children renders them on the server and in the client, hydrating without a mismatch
- [ ] #2 Compiler and runtime tests cover it
<!-- AC:END -->
