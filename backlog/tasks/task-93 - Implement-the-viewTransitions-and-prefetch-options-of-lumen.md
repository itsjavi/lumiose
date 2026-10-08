---
id: TASK-93
title: Implement the viewTransitions and prefetch options of lumen()
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:32'
labels:
  - app
  - build
dependencies: []
references:
  - examples/ssg-travel-journal/src/document.tsx
priority: medium
ordinal: 93000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec §7.5 and §8 (Dev and config) design MPA navigation with cross-document View Transitions and speculation-rules prefetch, configured by lumen({ viewTransitions, prefetch }). Neither option exists yet (docs/reference/vite.md lists them as designed but not built), while concepts/routing.md and rendering-modes.md describe MPA navigation as if both were built in. Found by TASK-37: the ssg-travel-journal sample opts in by hand with a global '@view-transition { navigation: auto; }' rule and a <script type="speculationrules"> in src/document.tsx. The defaults (on or off, eagerness) and the option shape are a DX decision for the user/Lux before implementation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen({ viewTransitions }) adds the cross-document View Transitions opt-in to every MPA page (static and server routes) in dev and builds, with the default decided and recorded
- [ ] #2 lumen({ prefetch }) adds speculation rules for same-origin links (eagerness configurable), in dev and builds, and stays off for spa routes, which prefetch through lumen/router
- [ ] #3 Docs (reference/vite.md, concepts/routing.md, rendering-modes.md) describe the options and their status accurately; tests cover the injected head content
- [ ] #4 examples/ssg-travel-journal uses the options instead of its hand-written opt-in
<!-- AC:END -->
