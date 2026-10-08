---
id: TASK-93
title: Implement the viewTransitions and prefetch options of lumen()
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 21:32'
updated_date: '2026-10-08 21:35'
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
- [ ] #1 lumen({ viewTransitions?: boolean }) defaults to false (opt-in per user decision-24); when true, static/server routes get @view-transition { navigation: auto } (disabled under prefers-reduced-motion) with a documented way to name elements that morph
- [ ] #2 lumen({ prefetch?: "hover" | "viewport" | "none" }) defaults to "hover": generated <script type="speculationrules"> for same-origin MPA links (moderate eagerness for hover, eager+in-viewport for viewport); SPA <Link prefetch> overrides per link; options validated in the plugin
- [ ] #3 Docs (routing, rendering-modes, reference/vite) updated in the same commits; the travel-journal example switches from its manual CSS/script opt-in to the options; tests
<!-- AC:END -->
