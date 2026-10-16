---
id: TASK-416
title: 'Number Field: no commit on blur in Firefox and WebKit'
status: To Do
assignee: []
created_date: '2026-10-16 03:06'
labels:
  - ui
  - browsers
dependencies: []
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), running examples/ui-e2e in Linux Firefox and WebKit (Playwright 1.63). In number-field.e2e.ts "bind:value keeps a signal in sync both ways": after ArrowUp (a commit), selecting the text, typing 7 and pressing Tab, onValueCommitted is not called (commits stay 1); Chromium passes. The element commits on the input's trusted `change` (number-field.script.ts #onChange), which these browsers do not seem to fire there: perhaps because the ArrowUp step wrote input.value programmatically. The test skips Firefox and WebKit with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 onValueCommitted reports a typed value when the input is left, in Chromium, Firefox and WebKit, and the test runs in all three
<!-- AC:END -->
