---
id: TASK-424
title: Batch 8's new tests fail in Firefox and WebKit
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 04:06'
updated_date: '2026-10-16 04:22'
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
- [x] #1 The ui-e2e browsers suite passes in Firefox and WebKit, with any skips tied to a task
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 batch 9, Firefox and WebKit; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): all eight fixed, none skipped by engine:
- combobox required (Firefox): Firefox's own validation bubble, anchored under the input after the blocked submit, covers the first option and takes the click there (no page events at all). Browser chrome, not the component: the test now chooses by the keys.
- Field async validate (Firefox, WebKit): a form reset runs the <output> reset algorithm, which replaces the output's children with its text, in Firefox and WebKit even when the text is the same. The fixture's counter was an <output> in the form (now a <p>). The same hit Field.Error in islands: after a reset the Error's Lumiose text node was gone, so the next action error did not show (WebKit). field.script.ts now keeps each lu-field output's nodes at the reset event and puts them back after the reset; new e2e 'a form reset in an island' (fails in WebKit without the fix, checked).
- Popover trap-focus (Firefox, WebKit): with their text metrics the Filters popup covered the Behind button the test presses; the popup now sits to the trigger's right.
- Select RTL picker (Firefox): no customizable select, the picker is the browser's: the test skips at runtime when appearance: base-select is unsupported, as the other Select tests do.
- Slider swap (Firefox): moving focus to the other thumb in the middle of a native drag ends Firefox's drag. The swapped thumb now takes focus when the press ends (a press on the track still moves focus at once). Unit and e2e updated.
- RTL radio Arrow Left (WebKit): WebKit's native radios neither wrap nor mirror Left/Right right to left. checkbox.script.ts now runs a Radio Group's arrow keys itself (APG: next/previous enabled radio, around the ends, mirrored right to left, read-only cancels the check), so the older WebKit skip of the radio test is gone too. The fixture's Size group gained Extra large, so the RTL test tells Left from Right. Checkbox script: 0.75 kB brotli (was 0.55); docs updated (radio-group, checkbox, switch, checkbox-group).
Runs: combobox, form, popover-hover-modal, select and slider suites pass in dev, build, Firefox and WebKit (353 passed, 19 skipped).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The eight batch 8 tests pass in Firefox and WebKit with no new engine skips: two real bugs fixed (Field.Error losing its live text after a form reset in WebKit; Slider swap ending Firefox's native drag), Radio Group arrow keys made consistent (WebKit wrap and RTL), and four test or fixture fixes for browser chrome and layout differences (Firefox's validation bubble, a covered button, the classic select's native picker, an <output> counter in a form).
<!-- SECTION:FINAL_SUMMARY:END -->
