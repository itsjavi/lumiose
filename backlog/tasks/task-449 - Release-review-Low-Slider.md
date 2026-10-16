---
id: TASK-449
title: 'Release review, Low: Slider'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:38'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 447000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Slider. Fix each, or record why it stays.

**Slider**
- **L21.** With `"none"`, a blocked move fires input, change and onValueCommitted. With push, Home or End collapses a range (documented; BU and APG stop at the neighbour).
- **L22.** Inside a Field, `Slider.Label`/`Value` `for` point at `…-thumb-0`, which doesn't exist (by code).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L21: With `"none"`, a blocked move fires input, change and onValueCommitted.
- [x] #2 L22: Inside a Field, `Slider.Label`/`Value` `for` point at `…-thumb-0`, which doesn't exist (by code).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- L21 (none): #move now applies the collision rules before it dispatches anything, and returns without input or change when no value changed; a native drag blocked by its neighbour has its input stopped at the element (the input listener now captures, so it also orders the values before any listener on the element or a thumb sees them), and its change stopped when the drag ends where it began; a track press commits only if it moved something. (A first attempt kept a 'committed' snapshot, but bind:value calls the element's value setter during input, so that is gone.)
- L21 (push): Home and End are the script's now: the ends, or in a range the neighbouring thumb ± minStepsBetweenValues, never pushing it (Base UI, APG). The existing range e2e test asserted the old collapse: rewritten (End stops at 75/80; PageUp still pushes).
- L22: SliderContext.thumbId(index): in a Field thumb 0 is the field's control; Label for and Value for use it. Unit test in slider.test.tsx fails without the fix.
- Tests: island fixture 'Blocked' (none, both thumbs at 50, counters for onValueChange and onValueCommitted); e2e 'a thumb blocked by the other reports nothing' and the rewritten range test fail without the script fix in dev, build, Firefox and WebKit.
- slider.md: keyboard table, blocked moves, script size 2.0 kB (1.98).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Blocked slider moves report nothing; Home and End stop at a range's neighbour; Label and Value point at the thumb inside a Field. Regression tests in all engines.
<!-- SECTION:FINAL_SUMMARY:END -->
