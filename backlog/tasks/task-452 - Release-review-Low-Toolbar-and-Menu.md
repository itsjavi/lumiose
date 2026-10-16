---
id: TASK-452
title: 'Release review, Low: Toolbar and Menu'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 14:17'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 450000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Toolbar and Menu. Fix each, or record why it stays.

**Toolbar and Menu**
- **L26.** Toolbar.Input:
  - arrowing in leaves the caret at 0 (BU selects the value);
  - Shift+ArrowRight at the end leaves the field.
- **L27.** Menu without JS: Escape in a submenu leaves focus on a hidden item.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L26: Toolbar.Input:
  - arrowing in leaves the caret at 0 (BU selects the value);
  - Shift+ArrowRight at the end leaves the field.
- [x] #2 L27: Menu without JS: Escape in a submenu leaves focus on a hidden item.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- L26 fixed in toolbar.script.ts: a text field the toolbar's keys move focus into has its text selected (select()), as Base UI; Shift+Left/Right in a text field are the field's (they select) and never move focus. e2e 'the arrows select a text field's text; Shift keeps its keys' fails without the fix in dev, build, Firefox and WebKit. toolbar.md updated.
- L27 stays, documented in menu.md: reproduced without JavaScript in Chromium, Firefox and WebKit (keyboard: Enter on Actions, Tab to Share, Enter, Tab to Email, Escape): the submenu closes and focus goes to the body, not to a hidden item; the browser's popover focus restoration does not return it to the submenu trigger, and without a script nothing can. With the script, Menu returns focus to the trigger (existing tests).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Toolbar text fields get their text selected when the arrows reach them and keep Shift+arrows; Menu's no-JS submenu Escape focus is a documented platform limitation.
<!-- SECTION:FINAL_SUMMARY:END -->
