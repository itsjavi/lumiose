---
id: TASK-394
title: 'Popover: open on hover, and the modal variant'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-16 00:22'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-356
priority: medium
ordinal: 393000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Halo in TASK-356 (2026-10-15): Base UI's Popover has `openOnHover` with `delay` and `closeDelay`, and a `modal` variant. They are not implemented yet. Keep doc-9 section 1.4.13 (content on hover) and section 3 in view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Popover.Trigger opens on hover with delay and closeDelay, keyboard and touch unaffected
- [x] #2 A modal popover traps focus and locks scroll like Base UI's
- [x] #3 Docs page, e2e and doc-9 results updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 sixth batch, branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): implemented (commits a99e71ba, 0d478821, 6af596af).

Open on hover (popover.script.ts, 2.13 kB brotli now, +0.4): Popover.Trigger `openOnHover`, `delay` (300) and `closeDelay` (0) become `data-open-on-hover`, `data-delay`, `data-close-delay`. A mouse or pen resting on the trigger opens the popup after the delay as a manual popover (dismissed by the shared layer model), without moving focus; it stays while the pointer is on the trigger or the popup, and closes after max(closeDelay, 100 ms grace to cross the gap) once the pointer left both. A pointer leaving or pressing before the delay cancels it. A click on the trigger of a hover-opened popup keeps it open (the popovertarget toggle is cancelled) until an outside press or Escape. Touch and the keyboard open it with a click, unchanged; focus does not open it. WCAG 1.4.13: dismissible (Escape without moving the pointer), hoverable, persistent: all tested.

Modal (decision-16): Popover.Root `modal` renders the Popup as a modal `<dialog closedby="any" data-side data-align>` anchored by the same placement CSS (placement.css now matches `:is([popover], dialog)[data-side]`), the Trigger as `command="show-modal" commandfor` with aria-expanded, Close as `command="close"`. The native modal dialog makes the page inert (focus stays inside, outside pointer interactions blocked by the backdrop), Escape and a press outside close it, popover.css locks scroll like Dialog's and makes the ::backdrop transparent, and the Root loads Dialog's script (invoker commands and closedby where missing, focus return, body scroll lock). Works without JavaScript through invoker commands. Base UI's `modal="trap-focus"` is not done (record), nor a Backdrop part. openOnHover is ignored on a modal popover.

Base UI 1.9 comparison: Trigger openOnHover/delay(300)/closeDelay(0) and Root modal true/false match; Base UI uses a safe polygon for the hover gap, we use a 100 ms grace (as Tooltip does). Zag hover-card: same open/close delays semantics.

doc-9 section 3 and 1: nested popovers, dismissal on main-button outside press, close requests, focus return (modal and hover), touch, RTL; 1.4.13 for hover; modal: inert outside, scroll lock, Escape. Section 17: 2.1.1, 2.4.3, 4.1.2 (aria-expanded on both trigger kinds), 2.4.7, 2.5.8, axe light and dark, closed, hover-open and modal-open.

Evidence: unit tests popover.test.tsx (hover attributes; modal dialog, command triggers and close), popover.types.test.tsx; ui-e2e e2e/popover-hover-modal.e2e.ts (no-JS modal via invoker commands, hover open/close/grace/closeDelay/pinned/Escape, keyboard and touch, modal focus containment, inert Tab, scroll lock, outside press not reaching the page, island bind:open for both with no LUM warnings, axe light/dark, focus, targets, per-page scripts); the existing popover suite still passes (its placement test gets a 1000px viewport under the longer nav). Docs: popover.md (Trigger API, modal, examples, keyboard, no-JS, browser support), live demo popover-3. Screenshots: backlog/assets/task-394-popover-hover.png, task-394-popover-modal-dark.png.

Sizes (min/gzip/brotli kB): popover script 5.69/2.38/2.13 (was 1.74 brotli); component JS 11.70/4.32/3.90 (bundles Dialog's script for modal); CSS 2.21/0.51/0.43.

New public names (TASK-400): `PopoverRootProps.modal`, `PopoverTriggerProps.openOnHover`, `delay`, `closeDelay`, trigger attributes `data-open-on-hover`, `data-delay`, `data-close-delay`.

2026-10-16 (Halo): checks green: pnpm check (2298 tests, cargo), pack:check --smoke --skip-npm, ui-e2e dev and build (559 passed; the 4 failures were this batch's: two per-page script checks missing the shared layer/place chunks and the Select picker flipping under the longer nav, fixed in the next commit, 70 passed on rerun), apps/web Playwright 125 passed. Claim released.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Popover opens on hover (`openOnHover`, `delay`, `closeDelay`: no focus move, hoverable with a 100 ms grace, persistent, Escape dismisses, a click keeps it open, touch and keys unchanged) and has a `modal` variant: a modal `<dialog>` anchored to its trigger and opened by invoker commands, with an inert page, scroll lock, Escape and outside-press dismissal and focus return, working without JavaScript. Unit, type and ui-e2e tests (incl. WCAG 1.4.13 and axe light/dark open and closed), docs, a live demo; all checks green. Gap: modal="trap-focus" and a Backdrop part. New names listed for TASK-400.
<!-- SECTION:FINAL_SUMMARY:END -->
