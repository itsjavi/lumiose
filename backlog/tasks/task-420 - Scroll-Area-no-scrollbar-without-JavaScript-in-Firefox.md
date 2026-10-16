---
id: TASK-420
title: 'Scroll Area: no scrollbar without JavaScript in Firefox'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 03:06'
updated_date: '2026-10-16 04:37'
labels:
  - ui
  - browsers
milestone: m-12
dependencies: []
ordinal: 418000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), in Linux Firefox (Playwright 1.63, JavaScript off). The viewport's computed scrollbar-width is none although lu-scroll-area is not defined (customElements.get and matches(':defined') say so): the only matching rule is lu-scroll-area:defined [data-viewport] in scroll-area.css. Gecko's style system seems to treat parser-created custom elements as :defined when the page runs without scripts, so the native scrollbar hides and the custom ones stay hidden. Gating the :defined rules on @media (scripting: enabled) would keep the native scrollbar. The scroll-area.e2e.ts no-JS test skips Firefox with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Without JavaScript, Scroll Area shows the native scrollbar in Firefox, and the test runs there
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned at the batch 8 merge. Found by Beacon's Firefox/WebKit runs (TASK-361); the test is skipped in that browser with this id.

2026-10-16 (Halo): claimed (M12 batch 9, Firefox and WebKit; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): not a component bug. In Playwright's Firefox every element reports a computed scrollbar-width of none (html, body, a fresh div with overflow: auto), with JavaScript on or off: Playwright hides Firefox's scrollbars for consistent headless runs. Gecko does match lu-scroll-area:not(:defined) and @media (scripting: none) without JavaScript (checked with an injected style), and the only scroll-area rule setting scrollbar-width did not match. Tried gating the :defined rules on @media (scripting: enabled): no change, reverted. Other :defined rules (OTP Field, Number Field, Tabs) checked without JavaScript in Firefox and WebKit: they behave. The no-JS test runs in Firefox again: it checks the viewport's scrollbar-width equals the root's (the page's own scrollbar), which still fails if our CSS hid it in Chromium or WebKit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No bug in Scroll Area: Playwright's Firefox hides every scrollbar (computed scrollbar-width none everywhere). The no-JS test now compares the viewport's scrollbar with the root's and runs in Firefox; the CSS is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
