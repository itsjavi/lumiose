---
id: TASK-410
title: 'Number Field, Autocomplete and Popover: gaps against Base UI'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 00:24'
updated_date: '2026-10-16 02:48'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-375
  - TASK-377
  - TASK-394
priority: low
ordinal: 409000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Recorded by Halo in batch 6 (2026-10-16).
- Number Field (TASK-375): `smallStep`, `snapOnStep` and `ScrubAreaCursor` are missing.
- Autocomplete (TASK-377): `autoHighlight`, `keepHighlight`, `submitOnItemClick` and `limit` are missing.
- Popover (TASK-394): `modal="trap-focus"` and a Backdrop part are missing. The hover gap uses a 100 ms grace period, as Tooltip does, not Base UI's safe triangle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each gap is closed with docs and e2e, or recorded as dropped with its reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo), against Base UI 1.x:
- Number Field `smallStep` (default 0.1, Alt with an arrow key or a button) and `snapOnStep` (a step lands on the next multiple of its own size from min or 0: 1.3 up is 2, Shift 37 up is 40): implemented; Shift on a button now takes largeStep too (Base UI does). `ScrubAreaCursor`: dropped. Base UI draws it because its scrub area takes pointer lock, which hides the real cursor; ours keeps the real (resize) cursor, so there is nothing to draw. Pointer lock (a scrub past the screen edge) could be a later option.
- Autocomplete `autoHighlight` (first match highlighted while typing, also when async results arrive; Enter fills it in), `keepHighlight` (by default the pointer leaving the list now takes away the highlight it gave, as Base UI; keyboard highlights stay), `submitOnItemClick` (requestSubmit after a click fills it in), `limit` (generic `limit` attribute on lu-combobox: matches past it are hidden): implemented.
- Popover `modal="trap-focus"`: implemented (`data-trap-focus` on the non-modal popup; the script loops Tab and Shift+Tab inside it; the page scrolls and takes presses). Backdrop part: dropped, an open popover is in the top layer, so `::backdrop` styles the layer under it with no element (documented). Hover safe triangle: implemented in hover.ts (shared with Preview Card): after the pointer leaves the trigger, each move inside the triangle from the exit point to the popup's near side restarts the grace; a stop or a move out lets it close. The e2e path test fails with the triangle disabled (checked).
Tests: unit (smallStep/snap, toward()), types, e2e (Weight field: Alt, snap, Shift-click; search form: autoHighlight + limit 3 + Enter, click submits ?q=docs, pointer highlight leaves vs keepHighlight on Country; Alan Turing far popover: 10 slow moves stay open, turning away closes; Filters trap-focus: Tab loop, no scroll lock, a press outside lands and closes). Sizes (brotli): number-field script 2.30 kB (was ~2.2), combobox script 4.25 kB (was ~4.1), popover script 2.58 kB (was ~2.3), preview-card 2.17 kB (was ~2.0). Proposed names: smallStep, snapOnStep (small-step, snap-on-step), autoHighlight, keepHighlight, submitOnItemClick, limit (auto-highlight, keep-highlight, submit-on-item-click, limit), modal="trap-focus" (data-trap-focus).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Number Field smallStep and snapOnStep; Autocomplete autoHighlight, keepHighlight, submitOnItemClick and limit; Popover modal="trap-focus" and a safe triangle for hover (shared with Preview Card). Dropped with reasons: ScrubAreaCursor (no pointer lock, the real cursor stays) and Popover.Backdrop (::backdrop of the top layer). Docs and e2e updated.
<!-- SECTION:FINAL_SUMMARY:END -->
