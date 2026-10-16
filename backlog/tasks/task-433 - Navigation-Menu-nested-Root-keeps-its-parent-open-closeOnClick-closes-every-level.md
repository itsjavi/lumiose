---
id: TASK-433
title: >-
  Navigation Menu: nested Root keeps its parent open; closeOnClick closes every
  level
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
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
- [ ] #1 Navigation Menu: nested Root keeps its parent open; closeOnClick closes every level, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->
