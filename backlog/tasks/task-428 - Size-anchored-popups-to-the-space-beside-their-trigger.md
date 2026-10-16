---
id: TASK-428
title: Size anchored popups to the space beside their trigger
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:51'
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
- [x] #1 Size anchored popups to the space beside their trigger, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (release-review fix batch 1; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): fixed. placement.css: anchored popups scroll (overflow: auto; max-block-size: var(--lu-available-height, none)), and after the flips they try new fallbacks that shrink them to the room beside the trigger: --lu-fit-below/--lu-fit-above (and --lu-fit-start/--lu-fit-end beside it), stretched between the trigger and the viewport edge. Two traps found: the popover and dialog UA styles give block-size: fit-content, which cannot stretch (the fallbacks set block-size: auto); and position-try-order: most-block-size, as proposed, makes Chromium sort the base position in with the fallbacks, so popups that fit moved (tooltip, popover end alignment and submenu tests broke): instead each fit fallback has min-block-size: min(8rem, 40dvh), so a side with too little room fails for the other. place.ts (no anchor positioning) takes the roomier side when neither fits and writes --lu-available-height; the theme's Menu and Combobox caps use it. Combobox core CSS: a Popup around the List is a flex column, so the list shrinks with it and scrolls. Menu script: a ResizeObserver keeps the focused item in view when the popup shrinks after an item took focus (during its opening transition, seen in dev). Tests: /menu at 640x400 (200% of 1280x800), End: menu and Delete in view; /combobox at 640x400: list and highlight in view. Both fail without the fix in dev, build, Firefox and WebKit, and pass with it; all popup suites green in the four projects. Docs: popover, menu, combobox.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Anchored popups that fit nowhere shrink to the room beside their trigger and scroll, the focused item or highlight in view; without anchor positioning --lu-available-height does the same. Regression tests at 200% zoom fail without the fix in Chromium, Firefox and WebKit.
<!-- SECTION:FINAL_SUMMARY:END -->
