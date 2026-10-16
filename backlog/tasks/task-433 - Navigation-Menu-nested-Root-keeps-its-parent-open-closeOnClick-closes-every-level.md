---
id: TASK-433
title: >-
  Navigation Menu: nested Root keeps its parent open; closeOnClick closes every
  level
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 11:03'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 431000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H7.

**H7. Navigation Menu: a nested Root closes its parent on focus, click and hover.** CONFIRMED in 3 engines, with the nested Root's server markup injected into the Products panel.
- **Keyboard:** Tab to the nested trigger. The parent closes and focus falls to `<body>`.
- **Click:** clicking the nested trigger leaves nothing open.
- **Hover:** moving onto it closes the parent after 50 ms.
- **closeOnClick:** a nested `closeOnClick` link leaves the parent open.
- **Cause:** `#onFocusOut`/`#onPointerOut`/`#onClick` use `#itemOf(to) === item`, which is undefined inside a nested `lu-navigation-menu`.
- **Violates:** navigation-menu.md's nested Root; BU NavigationMenuRoot nested tests; WCAG 2.1.1, 2.4.3.
- **Fix:** DOM containment (`item.contains(to)`). Close every level on a closeOnClick link. Add a nested fixture and e2e.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Navigation Menu: nested Root keeps its parent open; closeOnClick closes every level, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (release-review fix batch 1; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): fixed as proposed. navigation-menu.script.ts: #onPointerOut and #onFocusOut find this menu's item around the target by DOM containment (#itemAround) and treat the destination as inside when item.contains(to), so a nested Root in the content keeps the parent open on focus, click and hover. A closeOnClick link closes the open content of every menu it is inside (checked before the item lookup). Fixture: a nested Root ('More to learn', theme class, a closeOnClick 'API' link) in the Learn panel (Products kept as it was for the arrow tests). Three tests (Tab into it, click its trigger, hover onto it then click API) fail without the fix in dev, build, Firefox and WebKit (12 of 12) and pass with it; the whole suite passes in the four projects. Docs: nested Root and closeOnClick.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A nested Navigation Menu keeps its parent open on focus, click and hover, and a closeOnClick link in it closes every level. Regression tests on a nested fixture fail without the fix in Chromium, Firefox and WebKit.
<!-- SECTION:FINAL_SUMMARY:END -->
