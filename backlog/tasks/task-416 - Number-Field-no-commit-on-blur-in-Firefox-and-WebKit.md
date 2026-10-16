---
id: TASK-416
title: 'Number Field: no commit on blur in Firefox and WebKit'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 04:25'
labels:
  - ui
  - browsers
milestone: m-12
dependencies: []
ordinal: 414000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), running examples/ui-e2e in Linux Firefox and WebKit (Playwright 1.63). In number-field.e2e.ts "bind:value keeps a signal in sync both ways": after ArrowUp (a commit), selecting the text, typing 7 and pressing Tab, onValueCommitted is not called (commits stay 1); Chromium passes. The element commits on the input's trusted `change` (number-field.script.ts #onChange), which these browsers do not seem to fire there: perhaps because the ArrowUp step wrote input.value programmatically. The test skips Firefox and WebKit with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 onValueCommitted reports a typed value when the input is left, in Chromium, Firefox and WebKit, and the test runs in all three
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.

2026-10-16 (Halo): claimed (M12 batch 9, Firefox and WebKit; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): cause found in NumberField.Root, not the browsers. With bind:value, each typed character went to the signal and back as the value prop, and Root's effect wrote it into the element (host.value = next) while the user typed: the text was reformatted under the caret ('7' became '7 kg' at once, '7.' lost its point, in every browser), and the programmatic write reset Firefox's and WebKit's change baseline, so leaving the field fired no change. The effect now skips the echo (host.value !== next), as OTPField does. The island test runs in all browsers again (skip removed), types 7.5 and checks it stays and commits; it leaves the field with Shift+Tab, as the field is the page's last stop and Tab out of the page blurs nothing in Firefox.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
NumberField.Root no longer writes the bind:value echo back into the input while typing, which reformatted the text under the caret everywhere and cancelled the change on blur in Firefox and WebKit. onValueCommitted reports typed values in all browsers; the test runs in all three.
<!-- SECTION:FINAL_SUMMARY:END -->
