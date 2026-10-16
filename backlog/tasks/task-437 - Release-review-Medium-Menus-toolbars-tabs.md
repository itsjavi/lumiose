---
id: TASK-437
title: 'Release review, Medium: Menus, toolbars, tabs'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 12:00'
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
- [x] #1 M11: Roving widgets keep a tab stop when items change
- [x] #2 M12: Toolbar: every item keyboard-reachable before the script runs
- [x] #3 M13: Toolbar: disabled reaches Menu and Popover triggers and toggles
- [x] #4 M14: Toolbar: Menu triggers in a vertical toolbar
- [x] #5 M15: Context Menu: the innermost nested context menu opens
- [x] #6 M16: Menu: Space runs a LinkItem
- [x] #7 M17: Tabs: exactly one tab stop in server HTML and after settle
- [x] #8 M18: Scroll Area: wheel over the scrollbars scrolls the viewport
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (release-review fix batch 1; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): fixed all eight findings; each regression test fails without its fix in dev, build, Firefox and WebKit (52 runs fail on HEAD sources, pass with the fixes).
- M11: toolbar, menubar and toggle-group scripts observe their subtree (childList, disabled, hidden) and re-rove. Toolbar and Menubar keep the stop while it stays an item (#stop), else the first item; Toggle Group the first pressed, else enabled. Menubar items now skip hidden ones too. Tests: toolbar/menubar/toggle e2e 'the tab stop moves on…' and 'a group rendered disabled gets a tab stop once enabled'.
- M12: Toolbar's context has no stop(); items render no tabindex, so every item is a tab stop in server HTML; the script collapses them. The TASK-413 no-JS test now asserts Tab reaches every item. toolbar.test.tsx updated.
- M13: a disabled Root/Group gives Menu.Trigger, Popover.Trigger and Toggles aria-disabled; the triggers lose popovertarget/commandfor/data-open-on-hover (nothing opens without JS either); Toolbar.Root loads button.script, which cancels aria-disabled clicks. Fixture 'Locked' toolbar; unit and e2e tests (JS on and off).
- M14: the toolbar skips defaultPrevented keys; Menu treats a trigger in a vertical toolbar like one in a vertical menubar (opens on the inline-end arrow), and Menu.Popup defaults to side inline-end there. Fixture 'Shapes' toolbar.
- M15: lu-context-menu returns unless the closest enabled lu-context-menu around the target is itself. Fixture Board/Card on /context-menu.
- M16: Space on an a[role^=menuitem] (not while typing) prevents default and clicks it.
- M17: the server gives the stop to the tab value/defaultValue names (even a disabled one), else the first enabled tab so far (isServer); in the browser the reactive rule is unchanged. #settle always runs #select, normalising aria-selected, tabindex and panels. Unit (SSR, happy-dom) and e2e tests (JS on and off).
- M18: Scroll Area adds a non-passive wheel listener to each scrollbar: deltas scaled by deltaMode, applied with scrollBy(instant), preventDefault only when the viewport moved; ctrlKey skipped.
- macOS note: the new fixtures made /toolbar scroll at 720px, where Playwright's Home/End scroll the page instead of moving a text field's caret; the loop test sets a 1200px viewport.
- Docs: toolbar, menu, menubar, toggle-group, context-menu, tabs, scroll-area; script sizes refreshed across docs from pnpm size (dialog 1.3, popover 2.9, tooltip 1.6, menu 3.7, combobox/autocomplete 4.5, toast 2.6, toggle-group 0.9, context-menu 4.2 together, drawer 2.2 together, toolbar 1.0, scroll-area 1.6, menubar 0.7/4.4, navigation-menu 2.2, preview-card 2.4).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All eight Medium findings fixed with regression tests that fail without them in dev, build, Firefox and WebKit: roving tab stops survive removed/disabled items (Toolbar, Menubar, Toggle Group); toolbar items are all tab stops before the script; a disabled toolbar disables Menu/Popover triggers and Toggles; vertical toolbars open menus sideways; nested Context Menus open the innermost; Space runs Menu link items; Tabs has exactly one tab stop in server HTML and after settle; the wheel over Scroll Area scrollbars scrolls the area. Docs updated, sizes refreshed.
<!-- SECTION:FINAL_SUMMARY:END -->
