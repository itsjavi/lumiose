---
id: TASK-357
title: Menu
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 19:13'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-354
priority: high
ordinal: 358000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Menu.Root (lu-menu), Trigger (popovertarget, aria-haspopup), Popup (role="menu" popover), Item, CheckboxItem, Separator, then groups and group labels, radio items, submenus and placement. Running an item closes the menu and returns focus (APG).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The menu opens without JavaScript and follows the APG Menu Button contract (arrows, Home/End, typeahead, Escape, close on run)
- [x] #2 open/onOpenChange, onCheckedChange and bind: work with signals
- [x] #3 Keyboard-contract and axe tests pass
- [x] #4 Unstyled: ships only the CSS the primitive needs to work, in one low-priority layer
- [x] #5 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies
- [x] #6 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [x] #7 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. The package ships unstyled: only the CSS a primitive needs to work (display, positioning and anchoring, the top layer, CSS variables), in one low-priority layer; no theme, no design tokens. Example styling lives in docs and test pages only. Check the work against the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) before Done.

2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (Lux, orchestrator): reassigned to Spark so Menu runs in parallel with Halo's TASK-392, TASK-356 and TASK-359. Spark may edit packages/ui/src/menu/** and add Menu's lines to the shared package files (index.ts, package.json exports, styles.css, themes/default.css).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-15 (Spark): claimed for M12 in worktree branch claude/spark-m12-f6d150; starting from the ui-spike port (option b) and Dialog's structure.

2026-10-15 (Spark): implementation, on branch claude/spark-m12-f6d150 (commits b48c6f75, 28a496a9, 7fdfb9e0, 35163e6d, and the docs commit after merging main with TASK-393).

**What shipped.** `packages/ui/src/menu/`: `menu.tsx` (Root, Trigger, Popup, Item, LinkItem, CheckboxItem, Separator, Group, GroupLabel, RadioGroup, RadioItem, SubmenuRoot, SubmenuTrigger), `menu.script.ts` (the `lu-menu` element, loaded through `?client`), `menu.css` (lu.core: `lu-menu` no box, items in a column, anchor positioning by `data-side`/`data-align` with flip fallbacks). Default theme: `.lu-menu` block. Docs: `packages/ui/docs/menu.md`. Demo and e2e: `examples/ui-e2e` routes `/menu`, `/menu/island`, `/menu/dialog`, `e2e/menu.e2e.ts`. Screenshots: [light](../assets/task-357-menu-light.png), [dark](../assets/task-357-menu-dark.png).

**Design notes.**
- Native first: the trigger's `popovertarget` opens the `popover="auto"` popup in server HTML with no JavaScript; Escape and light dismiss are native. Once `lu-menu` is defined it toggles the popup on the trigger's click itself (`showPopover({ source })`), because the popover's `toggle` event comes a task later and keys typed meanwhile would miss the focus move.
- Focus: keyboard opening focuses the first item that can run (Arrow Up: the last), pointer opening the popup (Base UI). Focus moves to the trigger before the popup hides, so the popover never restores focus to whatever had it before a mouse press.
- Running an item closes the whole tree and returns focus in the click's capture phase, before the item's own handlers (so a handler that opens a dialog gets focus back on the trigger).
- Items are `<button>`s (Base UI: `<div>`), so they run with Enter and Space and are reachable with Tab without the script. No `tabindex="-1"`: with the script, Tab never moves between items.
- Placement: the same props and hooks as Halo's in-progress `packages/ui/src/placement` draft (`side`, `align`, `sideOffset`, `alignOffset`; `data-side`, `data-align`; `--lu-side-offset`, `--lu-align-offset`; anchor `--lu-<id>`), implemented in menu.css for now. When Halo's module lands, Menu can switch to it (follow-up).
- `bind:` on parts that extend element props: Lumiose brands intrinsic element props with a symbol and `LibraryManagedAttributes` offers no `bind:` on props that carry it, so `MenuCheckboxItemProps` and `MenuRadioGroupProps` omit symbol keys. Worth fixing in lumiose's JSX types (Beacon) so components that spread element props get `bind:` without the workaround.
- An island whose menu was opened from the server HTML before hydration keeps it open and reports `onOpenChange(true)` instead of closing it.

**New public names (for the user's review, beyond decision-62).**
- Parts `Menu.LinkItem`, `Menu.SubmenuRoot`, `Menu.SubmenuTrigger`, `Menu.Group`, `Menu.GroupLabel`, `Menu.RadioGroup`, `Menu.RadioItem` (Base UI 1.9 names).
- Props: `label`, `closeOnClick`, `disabled` on items (Base UI's); `defaultChecked`; RadioGroup `value`/`defaultValue`/`onValueChange` (`bind:value`); Popup `side`, `align`, `sideOffset`, `alignOffset` (same as Halo's Popover draft).
- Attributes and properties: `data-label`, `data-close-on-click` (item wiring for the script), `data-side`, `data-align`, `--lu-side-offset`, `--lu-align-offset`; theme class `.lu-menu`; GroupLabel renders `role="presentation"`.
- Export paths `@lumiose/ui/menu`, `@lumiose/ui/menu.css`; types `MenuSide`, `MenuAlign`, `Menu*Props`.
- Deliberate differences from Base UI: not modal (no scroll lock, a press outside closes the menu and reaches its target); `LinkItem` closes on click by default (Base UI keeps it open) because a layout's menu outlives a client navigation; submenu hover delay fixed at 100 ms; no `openOnHover` on the root trigger; no indicator parts.

**doc-9, section 1 (cross-cutting), applicable items.**
- [x] One Escape closes one layer: the element handles Escape itself (preventDefault, then the open submenu or the menu); inside a modal dialog Escape closes the menu, not the dialog (e2e "with dialogs").
- [x] Opening another menu closes the first (native auto popovers); a second non-nested modal: n/a (not modal).
- [x] A press inside a submenu keeps its parents (DOM-nested popovers); a press that starts inside and ends outside does not dismiss (native light dismiss needs down and up outside).
- [ ] Clicking a persistent element (toast) does not dismiss: n/a until Toast; native `popover=auto` light dismiss would close the menu. Note for the Toast task.
- [~] Outside-press filters: multi-touch, removed targets and drag-out handled by native light dismiss. **Gap:** Chromium light-dismisses a popover on a right-click outside; popover light dismiss is not cancelable (Dialog fixed this through `cancel`, which popovers lack). Recorded, no workaround.
- [x] Dismissal on click, not mousedown (native pointerup-based).
- [x] Safari and Firefox on macOS do not focus a pressed button: focus return skips presses that landed on something focusable (tracked on `pointerdown`), else goes to the trigger. Verified in Chromium only (the suite runs Chromium).
- [x] Inert: popups opened from a dialog go inside its Popup (docs, `/menu/dialog` e2e); a menu item that opens a dialog closes the menu first and focus returns to the menu trigger on close (e2e).
- [x] Scroll lock: n/a by design (non-modal; the popup follows its trigger through anchor positioning).
- [x] Focus return with `preventScroll`; skip on a focusable outside press. Gap: if the trigger is gone, focus is not moved elsewhere (Base UI falls back to the previous element).
- [x] Zero-delta pointer moves (keyboard scrolling under a resting pointer) are ignored.
- [x] Keys ignored while `isComposing` (unit test).
- [x] Animations: native popover with the theme's `overlay` transition; never rendered open on the server. Exit animation Chromium-only (documented).
- [x] Ids from `useId()`; the popup references its trigger and a group its label only while they render; an open popover is never server-rendered; the client script tag is nonce'd by Lumiose and `style` props become nonce'd rules under strict CSP.
- [x] RTL swaps Arrow Left/Right for submenus and the logical placement (e2e on `dir="rtl"`).

**doc-9, section 5 (menu).**
- [x] Enter, Space, Arrow Down open on the first item; Arrow Up on the last that can run (e2e).
- [x] Home/End, looping arrows; Tab closes and moves on; Shift+Tab closes onto the trigger (e2e).
- [x] Typeahead: 750 ms reset (Base UI), matches `label` or the text, skips hidden and natively disabled items, Space during a search is text (unit + e2e).
- [x] `aria-disabled` items highlight but do not run (unit + e2e).
- [x] Pointer: press-drag-release from the trigger runs an item; a release within 200 ms of the press does not; leaving the items clears the highlight (e2e).
- [x] Submenu keyboard: Arrow Right, Enter or Space opens (Arrow Left in RTL); Arrow Left closes onto its trigger (e2e).
- [x] Submenu hover: 100 ms delay; a triangle from the pointer's exit point to the submenu keeps it open across siblings (300 ms grace) (e2e).
- [x] Submenu dismissal: outside press closes the tree; Escape one level (closeParentOnEsc=false) (e2e).
- [x] Checkbox and radio items: roles, `aria-checked`, radio items in `role=group`, Space and Enter toggle, stay open by default (e2e).
- [x] Link items: Ctrl/Cmd/Shift click and `download` keep the menu open (Zag); Enter is a real click on the `<a>` (unit + e2e).
- [ ] Context menu long press: n/a (no Context Menu yet).
- [x] Scroll lock when opened by mouse: n/a by design (non-modal), see differences.
- [x] Native popover covers light dismiss, Escape and the top layer; roving focus, typeahead and submenu intent are in the script.

**doc-9, section 17 (WCAG 2.2 AA).** Automated: axe with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, closed and open (root, Share and More submenus, RTL menu, island menu, menu in a dialog), light and dark, default theme: 0 violations, no "needs review" results. Manual:
- [x] 2.1.1, 2.1.2: every action from the keyboard; Tab leaves the menu.
- [x] 2.4.3: focus moves through items in order and returns to the trigger.
- [x] 2.4.11: the focused item is never under the menu's own popups (submenus open beside their trigger and flip; focus moves into them).
- [x] 1.4.13: a hover-opened submenu closes with Escape without moving the pointer, can be hovered, and stays until dismissed.
- [x] 2.5.1, 2.5.7: press-drag-release has a click alternative; no long press.
- [x] 2.5.3: items are named by their text; checkbox and radio marks have empty alt text (`content: "✓" / ""`); the popup is labelled by its trigger.
- [x] 4.1.2: roles menu/menuitem/menuitemcheckbox/menuitemradio/group/separator; `aria-expanded`, `aria-checked`, `aria-disabled`, `aria-haspopup` follow the state.
- [x] 3.2.1, 3.2.2: focusing an item never runs it.
- [x] Theme 1.4.3 (axe color-contrast, light and dark), 1.4.11 (2px `--lu-ring` focus ring, 5.2:1 light, about 7:1 dark), 2.4.7 (e2e: 2px solid ring on the trigger and the focused item), 2.5.8 (items 32px tall; e2e smallTargets), 1.4.10 and 1.4.12 (e2e at 320px with text spacing: inside the viewport, nothing clipped), 1.4.1 (checked state shown by a mark, not colour).

**Checks** (after merging main with TASK-390 and TASK-393). `pnpm check` green: vitest 2107 passed, 2 skipped; typecheck, lint, fmt and fmt:examples; runtime caps OK (core + dom + islands 9.22 kB, whole client runtime 13.37 kB brotli); cargo tests (no Rust changes). `@lumiose/ui` unit tests 59 (menu 33). `examples/ui-e2e` Playwright, dev and build: 74 passed, 2 skipped by design; the Menu suite repeated twice: 90 passed. UI docs contract (`packages/cli/src/docs/ui.test.ts`, examples type-checked) 10 passed; `docs:check` for lumiose and @lumiose/ui clean; menu.md is listed in packages/ui/docs/llms.txt and the README marks Menu available. Size (`pnpm --filter @lumiose/ui size`): menu client script 6.94 kB min / 2.57 gzip / 2.29 brotli; component JS in islands 12.02 / 4.05 / 3.65; menu.css 1.80 / 0.43 / 0.37.

2026-10-15 (Spark): reopened before commit: the right-click gap contradicts the user's Dialog decision (close doc-9 gaps with the script). Fixing it in lu-menu.

2026-10-15 (Spark), addendum after reopening (commit d5891f0d):
- doc-9 section 1, outside-press filters: **closed**. The native popover light dismiss closes on any button and cannot be canceled (capturing the press in the popup avoided it but retargeted the page's contextmenu, so it was dropped). Where the script runs, lu-menu makes the popup a manual popover when it opens it and light-dismisses it itself: main button and first finger only, press and release both outside (a press inside a menu closes the submenus open from it), plus a CloseWatcher for close requests (Escape elsewhere, the Android back gesture; Chrome 126, Firefox 149). Server HTML keeps popover="auto" for no JavaScript. e2e: a right-click (the page still gets its contextmenu) and a middle click outside leave the menu open; unit tests for main/secondary/second-finger presses and submenu dismissal.
- The close watcher is destroyed with the hide, not on toggle a task later: an Escape right after a light dismiss inside a dialog now closes the dialog (found by the e2e).
- LUM2001: menu.tsx no longer warns for its own code; the remaining warning is the shared `isServer ? children` pattern of Dialog, noted on TASK-391.
- Docs: menu.md updated (dismissal, CloseWatcher support); after merging main with TASK-393, docs:gen lists Menu in packages/ui/docs/llms.txt and the UI README marks Menu available; the UI docs contract test (ui.test.ts, examples type-checked) passes.
- Checks now: pnpm check green (vitest 2109 passed, 2 skipped; lint, fmt, fmt:examples, runtime caps, cargo tests; no Rust changes). @lumiose/ui unit 61 (menu 35). examples/ui-e2e: 76 passed, 2 skipped by design (dev and build), and 152 passed with --repeat-each=2. Size: menu client script 7.25 kB min / 2.71 gzip / 2.43 brotli; component JS in islands 12.30 / 4.18 / 3.78; menu.css 1.80 / 0.43 / 0.37.

2026-10-15 (Spark), after Halo shared the placement module (5a95f4a9, merged into this branch; its parent is main d5d4db13): Menu.Popup uses placement() (root bottom/start, submenu inline-end/start), the triggers anchorName() and withStyle(); menu.css imports placement.css and drops its own position-area rules; lu-menu calls place() where CSS anchor positioning is missing (on open, scroll and resize). Placement e2e unchanged and passing. Size now: menu client script 8.62 kB min / 3.28 gzip / 2.94 brotli (place.ts fallback included); component JS 13.75 / 4.78 / 4.32; menu.css 2.07 / 0.51 / 0.43 (with placement.css). Checks: pnpm check green (vitest 2109 passed, 2 skipped); ui unit 61; ui-e2e 152 passed with --repeat-each=2 (4 skipped by design); UI docs contract 10 passed; docs regenerated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Menu for @lumiose/ui: thirteen parts on a native popover menu (popovertarget, anchor positioning through the shared placement module) that opens without JavaScript, plus the lu-menu client script (2.94 kB brotli, with the placement fallback) for the APG Menu Button contract, typeahead, checkbox and radio items, submenus with hover intent, press-drag-release, and Base UI's light dismiss (main button only, via a manual popover and CloseWatcher). open/onOpenChange, checked and value sync with signals and bind:. Unstyled core CSS in lu.core, a .lu-menu block in the default theme, docs page packages/ui/docs/menu.md (listed in the UI llms.txt), e2e in examples/ui-e2e with axe (WCAG A/AA, light and dark); doc-9 sections 1, 5 and 17 are recorded in the notes. New public names and the differences from Base UI are listed in the notes for the user's review.
<!-- SECTION:FINAL_SUMMARY:END -->
