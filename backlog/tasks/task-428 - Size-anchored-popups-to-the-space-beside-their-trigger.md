---
id: TASK-428
title: Size anchored popups to the space beside their trigger
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 426000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H2.

**H2. Anchored popups run past the viewport at 200% zoom and in short viewports.** Menu, Combobox, Autocomplete, Menubar. CONFIRMED in 3 engines; Prism re-verified.
- **Repro:** `/menu` at 640x400 (1280x800 at 200%). Enter on Actions, then End.
  - The popup spans y=185–569.
  - The focused "Delete" is at 532–564, off-screen.
  - Neither the page nor the popup scrolls.
- The combobox listbox is cut off the same way. Text-only 200% (root font-size 200% at 1280x900) puts the menu at 374–1137.
- The theme caps size with `min(24rem, 100dvh - 1rem)`, which ignores where the anchor is; placement.css only flips.
- **Violates:** WCAG 1.4.10, 1.4.4, 2.4.7. BU Positioner `--available-height`.
- **Fix:**
  - placement.css also sets the far inset (`bottom` with `top: anchor(bottom)`), `position-try-order: most-block-size`, and lets the popup scroll.
  - place.ts writes `--lu-available-height` in the fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Size anchored popups to the space beside their trigger, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->
