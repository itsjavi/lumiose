---
id: TASK-453
title: 'Release review, Low: Placement and Dialog'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 14:14'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 451000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Placement and Dialog. Fix each, or record why it stays.

**Placement and Dialog**
- **L28.** Popups don't hide when the trigger scrolls away, despite popover.md and placement.css:
  - on page scroll, in every engine;
  - in an inner scroller, everywhere but Chromium.
  Use an IntersectionObserver, or fix the docs.
- **L29.** Dialog initial focus differs by engine: Chromium focuses a scroller placed before the first control, and Chromium and WebKit focus a `tabindex=-1` Title. BU focuses the first tabbable element. This verifies doc-9 §2's unverified item.
- **L30.** Docs: preventing `cancel` stops only the first Escape. Point to `closedby="none"`.
- **L31.** Drawer initial focus goes to the first control; BU 1.9 focuses the popup. Document it or match.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L28: Popups don't hide when the trigger scrolls away, despite popover.md and placement.css:
  - on page scroll, in every engine;
  - in an inner scroller, everywhere
- [x] #2 L29: Dialog initial focus differs by engine: Chromium focuses a scroller placed before the first control, and Chromium and WebKit focus a `tabindex=-1` Title.
- [x] #3 L30: Docs: preventing `cancel` stops only the first Escape.
- [x] #4 L31: Drawer initial focus goes to the first control; BU 1.9 focuses the popup.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- L28: place.ts (shared by every anchored popup's script) listens to toggle at document capture; while a non-modal anchored popover ([popover][data-side]) is open, an IntersectionObserver watches the trigger its inline position-anchor names (read from the style attribute, so browsers without anchor positioning work too) and sets data-anchor-hidden on the popup while the trigger is out of view, of the page or of a scroller around it; placement.css (lu.core) hides it (visibility). position-visibility: anchors-visible stays for CSS-only pages (it covers inner scrollers, in Chromium). Fixture: a Status popover in a scroller on /popover. Tests (page scroll with the Notifications popover; the scroller) fail without the change in dev, build, Firefox and WebKit.
- L29: dialog.script.ts: on open (not by touch), the first focus goes to the autofocus element, else the first tab stop (tabIndex >= 0, enabled, visible, a radio group's checked radio), else the dialog itself. Fixture 'Terms' dialog (a tabindex=-1 title and a scroller before the Agree button); the test fails without the fix in Chromium (dev, build) and WebKit, as Prism found; Firefox already did it.
- L30: dialog.md: to keep a dialog open use closedby="none", not preventDefault on cancel (only the first of repeated close requests can be cancelled).
- L31: documented in drawer.md (first tab stop, as Dialog; Base UI focuses the drawer: give the Popup autofocus). Chromium ignores autofocus on a <dialog> itself, so the script now honours it (the dialog takes focus); fixture 'Notice' and test fail without it in Chromium.
- Also: layers.e2e.ts:26 was flaky in Firefox (about 1 in 10, before this batch's changes too): the mouse rested on Account through the reload, so its pointerover came before the popover script ran and Account never opened. The test now moves the mouse away before the reload: 240/240 in all four projects under --repeat-each=15 --workers=4.
- popover.md and menu.md mention data-anchor-hidden.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Anchored popovers hide while their trigger is scrolled out of view (page or scroller), in every engine; Dialog's initial focus is the first tab stop everywhere (autofocus on the dialog honoured); docs for closedby=none and Drawer focus. Regression tests fail without each fix in the engines named.
<!-- SECTION:FINAL_SUMMARY:END -->
