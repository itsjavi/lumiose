---
id: TASK-219
title: 'Website accessibility: WCAG 2.2 AA with axe in the e2e suite'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-11 00:18'
labels:
  - a11y
  - site
milestone: m-7
dependencies: []
priority: high
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-39 (user 2026-10-11): the website must meet WCAG 2.2 AA. Add @axe-core/playwright to apps/web's Playwright suite (take .local/coordination/deps.lock for the dependency) and run it on every page type: landing, a docs page, an error page, benchmarks, showcase and demos indexes, the playground, the 404. Fail on violations for the wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa tags; list axe's 'needs review' results (text on gradients or canvases) in the test output and check them by hand. Cover what axe cannot: ambient motion longer than 5 seconds has a pause control (2.2.2), prefers-reduced-motion stops non-essential motion, visible focus (2.4.7), focus not hidden by sticky UI (2.4.11), target size of at least 24 px (2.5.8), and text over animated or image backgrounds sits on a backdrop that guarantees 4.5:1. Fix what it finds, in the site and in @lumiose/site-kit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The e2e suite runs axe on every page type and fails on any WCAG 2.0/2.1/2.2 A or AA violation
- [ ] #2 Current violations are fixed; 'needs review' items are listed and were checked by hand, with results in the task notes
- [ ] #3 A checklist for the manual criteria (motion pause, reduced motion, focus visible and not hidden, target size, text over moving backgrounds) is in the site's contributing notes and applied to the landing redesign
<!-- AC:END -->
