---
id: TASK-613
title: '@lumiose/ui default theme in plain black and white'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-11-17T12:29:00Z'
labels: []
milestone: m-16
dependencies: []
references:
  - backlog/assets/redesign/b-first-light.html
ordinal: 605000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the default theme of @lumiose/ui unopinionated (decision-90): black, white and greys through the --lu- custom properties, square or minimal radii, no brand colour except one overridable accent. Projects restyle by overriding the custom properties.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 themes/default.css uses only black, white, greys and one accent custom property, in light and dark
- [ ] #2 Every component state (hover, focus, pressed, disabled, invalid) keeps WCAG AA contrast: 4.5:1 for text, 3:1 for controls and focus rings
- [ ] #3 packages/ui/docs describe the theme and how to override it, and the changelog notes the visual change
- [ ] #4 The ui unit, e2e and a11y suites pass; the local UI showcase renders every component in the new theme
<!-- AC:END -->
