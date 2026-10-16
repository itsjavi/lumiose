---
id: TASK-442
title: 'Release review, Low: Toast'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:25'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 440000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Toast. Fix each, or record why it stays.

**Toast**
- **L1.** A press on a toast's text pauses its timer until focus moves. The viewport is `tabindex=-1`. BU pauses on `:focus-visible` only. Task: "Toast timers pause on keyboard focus only".
- **L2.** Pulling a swipe back to 40px or more still closes the toast. BU cancels on a 10px reversal. Task: "Toast swipe cancels when the gesture reverses".
- **L3.** `touch-action` blocks pinch-zoom that starts on a toast. Use `pan-x pinch-zoom` and the like. Task: "Swipeable toasts keep pinch-zoom".
- **L4.** SUSPECTED: `add()` with an open toast's id remounts the toast instead of updating it. BU upserts. Task: "Toast add() with an existing id updates in place".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L1: Toast timers pause on keyboard focus only
- [x] #2 L2: Toast swipe cancels when the gesture reverses
- [x] #3 L3: Swipeable toasts keep pinch-zoom
- [x] #4 L4: Toast add() with an existing id updates in place
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): all four fixed, each with an e2e test in toast.e2e.ts that fails without its fix (dev, build, Firefox, WebKit unless noted).
- L1: the viewport's focusin counts as a pause only when the target matches :focus-visible (also after a removed toast moves focus). The existing pause test now focuses the region with F6.
- L2: the swipe tracks its farthest distance; released 10px or more back from it, the toast springs back (SWIPE_REVERSAL = 10, as Base UI). Test: drag to 120px, back to 50px: stays (fails without the fix in all four).
- L3: touch-action adds pinch-zoom (pan-x/pan-y pinch-zoom, pinch-zoom for both axes) inside @supports (touch-action: pinch-zoom), so engines that do not know it keep the old values. Test skips where CSS.supports says no (it ran in all four here).
- L4: manager.add() with the id of an open (not ending) toast sets its fields in place, keeping the object and position; a closing toast's id still adds a new one. toast.test.tsx updated (the old test asserted the replace); island 'Sync' button and e2e test (same element after a second add).
Docs: toast.md (add, timers, swipe, touch-action).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Toast timers pause on keyboard focus only; a reversed swipe springs back; swipeable toasts keep pinch-zoom where touch-action supports it; add() with an open toast's id updates it in place. Regression tests fail without each fix.
<!-- SECTION:FINAL_SUMMARY:END -->
