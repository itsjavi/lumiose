---
id: TASK-408
title: 'Slider: swap collision, thumb alignment and a group role'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 23:25'
updated_date: '2026-10-16 02:38'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-372
priority: low
ordinal: 407000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Gaps against Base UI 1.9 that Halo recorded in TASK-372 (2026-10-16): the `swap` thumb collision behaviour, `thumbAlignment`, and a `role="group"` around a range slider's thumbs. The filled part of the track can also end up to 12px from a thumb's centre. The thumb hides the gap, but it is visible with a thin custom thumb.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each gap is closed with docs and e2e, or recorded as dropped with its reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo), against Base UI 1.x:
- `thumbCollisionBehavior="swap"`: implemented for drags (a native thumb drag and a press on the track). A thumb dragged past another trades places with it; the values stay in order, the other thumb takes the dragged value and focus, and the drag goes on with it. A native drag cannot be handed to another input, so the pressed thumb stays put (its value is reset on each input) and its drag drives the other thumb until pointerup (a proxy in slider.script.ts). Keys stop at the neighbour, as `none` (Base UI: swap is about pointer interactions). minStepsBetweenValues applies to keys only in swap mode.
- `thumbAlignment`: implemented as `"edge"` (default, the thumbs stay inside the control as native ones do) and `"center"` (the inputs outgrow the control by half a thumb, so thumb centres reach its ends). Base UI defaults to center; `edge-client-only` is not offered (the server HTML is already right).
- The Indicator ending up to 12px from a thumb's centre: fixed. New `--lu-slider-thumb-size` (the theme sets 1.5rem and sizes its thumbs with it); slider.css insets the track by half a thumb, so the track runs between the thumbs' centres and `--lu-slider-start/end` percentages land on thumb centres (e2e: within 1px at 40 and 100). Core CSS now also spans the thumbs over the control (inline-size: 100%, moved from the theme); the theme no longer sets the inputs' margin or the track's 100% size.
- `role="group"` around a range's thumbs: on Slider.Control (the Root's attributes render before its children on the server, so the Root cannot know a Label exists), named by the Label (`aria-labelledby`), only for 2+ thumbs.
Tests: SSR (group, data-thumb-alignment), DOM (swap with a native-drag proxy, keys stop), types, e2e (swap drag hands over value and focus and continues; indicator end at thumb centre; center reaches the control's ends; range group named Price; fixture adds Zoom (center) and Ages (swap); reflow test allows the center control's intended overhang). Sizes: script 1.76 kB brotli (was ~1.5), slider.css 0.39 kB (was ~0.3). Screenshot: backlog/assets/task-408-slider-range.png. Proposed names: thumbCollisionBehavior "swap", thumbAlignment ("edge" | "center"), data-thumb-alignment, --lu-slider-thumb-size.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slider: swap collision for drags (native drags proxied to the swapped thumb), thumbAlignment edge|center, the Indicator ends at the thumb's centre via --lu-slider-thumb-size (theme sets it), and a range's Control is a role=group named by the Label. Docs and e2e updated.
<!-- SECTION:FINAL_SUMMARY:END -->
