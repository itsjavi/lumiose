---
id: TASK-424
title: Batch 8's new tests fail in Firefox and WebKit
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 04:06'
labels:
  - ui
  - test
milestone: m-12
dependencies: []
priority: high
ordinal: 422000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found at the batch 8 merge (2026-10-16). Lux ran the ui-e2e browsers suite: Linux Firefox and WebKit through the Playwright 1.63.0 Docker image, with UI_E2E_WS (TASK-361). Result: 791 passed, 21 skipped, 8 failed. All 8 are tests added in batch 8, which ran in Chromium only. CI's ui-browsers job would fail on them.

- firefox: combobox.e2e.ts:317 (forms, required: an empty combobox blocks the submit and is reported at its input)
- firefox and webkit: form.e2e.ts:367 (async validate and Field.Validity: typing waits for the debounce; a taken login shows and blocks the submit)
- firefox and webkit: popover-hover-modal.e2e.ts:166 (modal="trap-focus" keeps Tab in the popup, and the page usable)
- firefox: select.e2e.ts:221 (right to left: the picker lines up with the select's inline start)
- firefox: slider.e2e.ts:168 (thumbCollisionBehavior="swap")
- webkit: form.e2e.ts:479 (right to left: a radio group's Arrow Left goes to the next radio)

Fix each component bug, or skip the test in that browser with a task id and the reason, as TASK-361 does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The ui-e2e browsers suite passes in Firefox and WebKit, with any skips tied to a task
<!-- AC:END -->
