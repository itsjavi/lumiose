---
id: TASK-392
title: Dialog and the default theme against WCAG 2.2 AA
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 18:00'
labels:
  - ui
  - a11y
milestone: m-12
dependencies: []
priority: high
ordinal: 391000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17). Dialog (TASK-355) and the default theme (TASK-353) shipped before the requirement. Switch the axe checks in examples/ui-e2e to the WCAG A and AA tags (as apps/web/e2e/a11y.e2e.ts does), run them closed and open with the default theme in light and dark, check the manual criteria of section 17 that apply to Dialog and the theme (contrast, non-text contrast, focus visible, target size, reflow at 320px, text spacing), and fix what fails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/ui-e2e runs axe with the WCAG A and AA tags, closed and open, light and dark, and passes
- [ ] #2 The default theme meets the visual criteria of section 17, with contrast ratios recorded
- [ ] #3 Dialog meets the manual criteria that apply, recorded in the task
<!-- AC:END -->
