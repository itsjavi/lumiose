---
id: TASK-332
title: 'Spike: depend on, port or merge Timeless for @lumiose/ui'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 12:00'
labels:
  - proposal
  - needs-decision
  - ui
milestone: m-12
dependencies: []
priority: high
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-54, @lumiose/ui follows Timeless (timeless.build): native-first custom elements in the light DOM and CSS over native HTML, server-rendered without hydration, with Base UI's part anatomy and data attributes as API inspiration and Zag.js considered later for widgets Timeless lacks. Timeless is young (0.2.0), so compare: (a) depending on @timelessui/components, (b) porting its philosophy and code into @lumiose/ui, (c) merging Timeless into this monorepo. Prototype dialog, menu and combobox for the viable options and compare coupling, release cadence, server rendering without hydration, the glue with signals and bind:, bundle size, accessibility testing and maintenance. The result is a proposal for the user, including the component API shape.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dialog, menu and combobox are prototyped for each viable option
- [ ] #2 A comparison on the criteria above and a recommended option with its API shape are reviewed by the user
- [ ] #3 The approved option is recorded as a decision and M12's implementation tasks are created
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Lux, orchestrator): the user started the spike with workers; Halo (owner of the design system, @lumiose/site-kit) runs it and returns the proposal for the user's review.
<!-- SECTION:NOTES:END -->
