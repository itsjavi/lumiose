---
id: TASK-361
title: UI test kit
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-16 00:41'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: medium
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike (removed in TASK-363; it remains in the git history), proposal and measurements in TASK-332's notes). Keyboard-contract and axe Playwright suites per component in CI, porting Timeless's contract cases; before @lumiose/ui 0.1.0, a screen reader pass (VoiceOver, NVDA) and Firefox and WebKit runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every component has keyboard-contract and axe suites in CI
- [ ] #2 The screen reader, Firefox and WebKit passes are recorded before 0.1.0
- [ ] #3 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).
<!-- SECTION:NOTES:END -->
