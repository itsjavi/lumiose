---
id: TASK-507
title: Modal scroll lock adds a scrollbar gutter on pages that had no scrollbar
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-21 04:56'
updated_date: '2026-10-23 09:27'
labels:
  - ui
dependencies: []
priority: low
ordinal: 503000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing the drawer e2e test on Linux (TASK-506). packages/ui/src/dialog/dialog.css sets ':root:has(dialog:modal) { overflow: hidden; scrollbar-gutter: stable }' to keep the layout from shifting where the page had a classic scrollbar. Where it had none (a short page), the stable gutter appears when the dialog opens: with classic scrollbars (Linux, Windows) the page narrows by 15 px and a full-width drawer leaves a 15 px strip at the inline end. Measured on /drawer of examples/ui-e2e in Linux Chromium: 1280 px before, 1265 px with the dialog open. Cosmetic; CSS alone cannot tell whether the root overflowed. Options: accept and document it; or have the dialog script set the gutter only when the root overflows (the no-JS case keeps today's CSS).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision on the trade-off is recorded, and the docs of Dialog and Drawer mention the behaviour with classic scrollbars
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23 (Halo): with JavaScript, Dialog script already dropped the gutter on a page that fits; the strip TASK-506 met was the no-JS case. dialog.css now sets the gutter with a scroll-driven animation (animation-timeline: scroll(root block), active only while the root has scrollable overflow) inside @supports (animation-timeline: scroll()), and the rule itself sets auto; browsers without scroll timelines (Firefox) keep stable without the script. The script now sets the gutter inline either way (stable where the page overflows, auto where it fits), so it does not depend on the animation. Recorded as decision-79.

Measured in Linux Chromium (Playwright 1.63.0 image) with classic scrollbars shown: a page that fits stays 1280 px (was 1265), a page that overflows stays 1265 px, and a ResizeObserver on the root saw no intermediate width (no one-frame shift), with and without JS. Evidence: backlog/assets/task-507-drawer-linux-before.png (root and drawer 1265 px, empty strip at the right edge) and backlog/assets/task-507-drawer-linux-after.png (1280 px).

e2e: drawer.e2e.ts checks that the drawer spans a page that fits (computed scrollbar-gutter auto, root and drawer as wide as the viewport), with and without JS (the no-JS case skipped in Firefox, reason in the test); the TASK-506 root-width comparison stays. dialog.e2e.ts: a page that overflows keeps stable without JS, the island test also compares the root width, and the overflow preconditions are asserted. The new no-JS test fails on Linux with the old CSS (stable) and passes with the new. Runs: dialog and drawer specs in macOS Chromium dev and build (73 passed), Linux Chromium dev and build 3 times (219 passed), Linux Firefox and WebKit (73 passed, 1 skipped). ui vitest 468 passed; ui docs:gen and docs:check; pnpm typecheck and lint. Docs: dialog.md (Styling, Browser support) and drawer.md (Styling, Browser support).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The modal scroll lock reserves a scrollbar gutter only where the page overflows: Dialog script sets it either way from a measurement, and without the script a scroll-driven animation in dialog.css does (Chromium, WebKit); Firefox without JavaScript keeps the gutter. decision-79 records the trade-off, Dialog and Drawer docs describe classic scrollbars, and ui-e2e covers both cases (checked in Linux Chromium, Firefox and WebKit).
<!-- SECTION:FINAL_SUMMARY:END -->
