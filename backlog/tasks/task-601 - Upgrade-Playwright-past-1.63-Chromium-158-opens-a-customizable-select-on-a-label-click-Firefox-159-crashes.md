---
id: TASK-601
title: >-
  Upgrade Playwright past 1.63: Chromium 158 opens a customizable select on a
  label click, Firefox 159 crashes
status: To Do
assignee:
  - Halo
created_date: '2026-11-10T16:56:00Z'
updated_date: '2026-11-11T02:25:00Z'
labels:
  - ui
  - e2e
dependencies: []
priority: medium
ordinal: 593000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Playwright 1.65.0 (Chromium 158.0.8127, Firefox 159.0) broke two things in examples/ui-e2e, so TASK-599's upgrade was rolled back to 1.63.0. Both reproduce locally.

1. Chromium 158: a click on a <label for> of a customizable select (appearance: base-select) now opens the picker and focuses an option, where it used to focus the select only. e2e/select.e2e.ts:136 asserts the old behaviour. Decide whether @lumiose/ui follows the browser or keeps the old behaviour, then update the test and docs.
2. Firefox 159 (Playwright build 1572): the page crashes in drawer.e2e.ts:207 (touch swipe), the tooltip and popover-hover-modal axe tests, select.e2e.ts:173, and most of virtualizer.e2e.ts and virtual-components.e2e.ts. Find what crashes it (a browser bug or something in @lumiose/ui) and whether release Firefox is affected.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ui-e2e passes in Chromium, Firefox and WebKit on the newest Playwright
- [x] #2 The label-click behaviour of a customizable select is decided and documented
- [x] #3 The cause of the Firefox crashes is recorded, with an upstream report proposed if it is a browser bug
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux (standalone session, user request 2026-11-11).

Firefox: an upstream bug in Playwright 1.65.0's Firefox build (159.0, build 1572), with no Lumiose code involved. Minimal reproduction: page.setContent('<h2 id=h>People</h2><ul aria-labelledby=h><li>a</li></ul>'), then getByRole('list', { name: 'People' }).count(), then getByRole('list', { name: 'People' }).locator('li').evaluateAll(...) crashes the page. Either call alone is fine, and aria-label instead of aria-labelledby is fine. Playwright 1.66.0-alpha-2026-11-10 (Firefox build 1575) does not crash, so it is fixed upstream and needs no report. Release Firefox is not shown to be affected: the trigger is Playwright's role selector.

Chromium 158: the label click is the browser's own behaviour for a native select; @lumiose/ui has no code for it. Decision: follow the browser. e2e/select.e2e.ts:136 now accepts both (focus only, or picker open with focus on the selected option, closed again by Escape) and passes on Chromium 153 (Playwright 1.63) and 158 (1.65); packages/ui/docs/select.md says so.

Blocked: AC #1 waits for a stable Playwright 1.66. Then bump @playwright/test in every package.json and run ui-e2e in Chromium, Firefox and WebKit. Playwright stays on 1.63.0 until then.
<!-- SECTION:NOTES:END -->
