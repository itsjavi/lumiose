---
id: TASK-361
title: UI test kit
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-15 16:46'
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
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Keyboard-contract and axe Playwright suites per component in CI, porting Timeless's contract cases; before @lumiose/ui 0.1.0, a screen reader pass (VoiceOver, NVDA) and Firefox and WebKit runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every component has keyboard-contract and axe suites in CI
- [ ] #2 The screen reader, Firefox and WebKit passes are recorded before 0.1.0
<!-- AC:END -->
