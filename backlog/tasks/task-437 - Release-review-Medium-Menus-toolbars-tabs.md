---
id: TASK-437
title: 'Release review, Medium: Menus, toolbars, tabs'
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
priority: medium
ordinal: 435000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Menus, toolbars, tabs. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M11. Roving tab stop lost when its item is removed or disabled.** Toolbar, Menubar, Toggle Group. CONFIRMED in Chromium and Firefox.
- **Observed:** remove or disable the stop item (Undo, Edit, "Left") and Tab skips the whole widget. A Toggle Group rendered disabled and then enabled has no stop either (by code).
- **Cause:** `#rove()` runs only on connect and focusin.
- **Violates:** WCAG 2.1.1; BU Menubar and Toolbar tests.
- **Fix:** a MutationObserver (childList, `disabled`, `hidden`) re-roves.

**M12. Toolbar: without JS (and before the script loads), only the first item is reachable.** CONFIRMED.
- e2e asserts this (TASK-413), and toolbar.md doesn't warn about it. Menubar does the opposite.
- **Violates:** WCAG 2.1.1 without JS.
- **Fix:** every item tabbable in server HTML; the script collapses them to one stop.

**M13. Toolbar: `disabled` on Root or Group doesn't reach Menu triggers, Popover triggers or Toggles.** CONFIRMED by SSR.
- Those triggers render enabled and still open.
- **Violates:** toolbar.md; BU "disables all toolbar items except links"; WCAG 4.1.2.
- **Fix:** they read `toolbar.disabled()`, render `aria-disabled`, and their scripts refuse to act.

**M14. Toolbar (vertical) with a Menu trigger: ArrowDown opens the menu and also moves toolbar focus.** CONFIRMED in 3 engines.
- **Fix:** the toolbar skips `defaultPrevented` keys; Menu treats a vertical toolbar like a vertical menubar (opens on the inline-end arrow, side `inline-end`).

**M15. Context Menu nested: the outer menu opens instead of the inner one** (right-click and Shift+F10). CONFIRMED in Chromium and Firefox.
- **Violates:** BU ContextMenuTrigger.test nested.
- **Fix:** return when `defaultPrevented`, or when the closest `lu-context-menu` isn't this one.

**M16. Menu: Space doesn't run a LinkItem.** CONFIRMED in 3 engines.
- **Violates:** menu.md; BU MenuLinkItem "activates with Enter and Space".
- **Fix:** Space on `a[role=menuitem]` when not typing: `preventDefault` and `click()`.

**M17. Tabs: server HTML has two tab stops when the first tab is disabled and there is no defaultValue.** CONFIRMED in Chromium and Firefox, build and dev, JS on and off.
- **Repro:** `/tabs`, "Vertical, first tab disabled".
- With `defaultValue` on a disabled tab, the no-JS HTML has no stop at all (by code).
- **Cause:** one-pass SSR; `#settle` only fixes a missing or disabled selection.
- **Violates:** doc-9 §8; APG.
- **Fix:** `#settle` always normalises tabindex and aria-selected; the server gives the stop to the selected tab only.

**M18. Scroll Area: the wheel over a custom scrollbar scrolls the page, not the area.** CONFIRMED in 3 engines.
- **Violates:** BU ScrollAreaScrollbar wheel tests.
- **Fix:** a non-passive wheel listener on `[data-scrollbar]` that applies the deltas (honouring deltaMode), skips `ctrlKey`, and calls `preventDefault` only when the area scrolled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M11: Roving widgets keep a tab stop when items change
- [ ] #2 M12: Toolbar: every item keyboard-reachable before the script runs
- [ ] #3 M13: Toolbar: disabled reaches Menu and Popover triggers and toggles
- [ ] #4 M14: Toolbar: Menu triggers in a vertical toolbar
- [ ] #5 M15: Context Menu: the innermost nested context menu opens
- [ ] #6 M16: Menu: Space runs a LinkItem
- [ ] #7 M17: Tabs: exactly one tab stop in server HTML and after settle
- [ ] #8 M18: Scroll Area: wheel over the scrollbars scrolls the viewport
<!-- AC:END -->
