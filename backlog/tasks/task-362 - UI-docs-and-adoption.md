---
id: TASK-362
title: UI docs and adoption
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-16 01:47'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-355
  - TASK-357
  - TASK-358
priority: medium
ordinal: 363000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike (removed in TASK-363; it remains in the git history), proposal and measurements in TASK-332's notes). A docs page per component (parts, props, events, styling hooks, keyboard contract), written with Beacon, and @lumiose/site-kit and apps/web adopting the widgets where they hand-roll them today.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every shipped component has a docs page with a type-checked example
- [ ] #2 site-kit and apps/web use the widgets
- [ ] #3 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [ ] #4 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [ ] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [ ] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15: the per-component docs are published in the site's UI section (TASK-387), which the user asked for as the @lumiose/ui docs.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).
<!-- SECTION:NOTES:END -->
