---
id: TASK-507
title: Modal scroll lock adds a scrollbar gutter on pages that had no scrollbar
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-21 04:56'
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
- [ ] #1 A decision on the trade-off is recorded, and the docs of Dialog and Drawer mention the behaviour with classic scrollbars
<!-- AC:END -->
