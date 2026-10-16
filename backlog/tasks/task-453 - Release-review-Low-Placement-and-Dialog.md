---
id: TASK-453
title: 'Release review, Low: Placement and Dialog'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
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
- [ ] #1 L28: Popups don't hide when the trigger scrolls away, despite popover.md and placement.css:
  - on page scroll, in every engine;
  - in an inner scroller, everywhere
- [ ] #2 L29: Dialog initial focus differs by engine: Chromium focuses a scroller placed before the first control, and Chromium and WebKit focus a `tabindex=-1` Title.
- [ ] #3 L30: Docs: preventing `cancel` stops only the first Escape.
- [ ] #4 L31: Drawer initial focus goes to the first control; BU 1.9 focuses the popup.
<!-- AC:END -->
