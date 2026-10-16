---
id: TASK-450
title: 'Release review, Low: Button'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:44'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 448000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Button. Fix each, or record why it stays.

**Button**
- **L23.** SUSPECTED: `focusableWhenDisabled` cancels only click; pointerdown, mousedown and keydown handlers still run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L23: SUSPECTED: `focusableWhenDisabled` cancels only click; pointerdown, mousedown and keydown handlers still run.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): L23 confirmed by reading (only click was cancelled) and fixed in button.script.ts: pointerdown, mousedown, and Enter/Space keydown and keyup on an aria-disabled button (without a role) stop propagating at the document's capture phase (keys also preventDefault), so the button's own handlers (on:x and delegated onX) and its ancestors' bubbling ones never run, as in Base UI; capturing listeners (layer.ts's outside press, Dialog's press tracking) still see them, the press still focuses the button, and other keys (Tab, a toolbar's arrows on a soft-disabled item) go on. Unit test in button.script.dom.test.ts fails without it. button.md updated; script 0.2 kB brotli (was 0.1). ui-e2e button, toolbar and form green in all four projects.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A soft-disabled Button's presses and Enter/Space reach none of its handlers (capturing listeners still do); unit test.
<!-- SECTION:FINAL_SUMMARY:END -->
