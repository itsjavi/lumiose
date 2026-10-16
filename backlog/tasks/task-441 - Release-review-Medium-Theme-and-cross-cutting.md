---
id: TASK-441
title: 'Release review, Medium: Theme and cross-cutting'
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
priority: medium
ordinal: 439000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Medium findings for Theme and cross-cutting. Fix each, or record why it stays (with the user's agreement for a deliberate difference).

**M37. Theme: forcing a colour scheme doesn't work in builds, contrary to theming.md.** CONFIRMED in 3 engines.
- Dev works. In the build, an unlayered `:root{color-scheme:dark}`, a subtree, or a JS toggle keeps the light tokens. With dark UA colours, the UA link on `#fff` is 2.39:1.
- **Cause:** the CSS target (Safari 17.4) makes Lightning CSS lower `light-dark()` to `prefers-color-scheme` variables.
- **Fix:** raise the target to 17.5, exclude light-dark from lowering, or fix the docs.

**M38. Forced colors (beyond AA): state indicators vanish.** CONFIRMED in Chromium emulation.
- Switch on and off look identical; a pressed Toggle looks unpressed.
- Horizontal selected tabs have no indicator, and every vertical tab looks selected.
- Progress bars, the Slider Indicator and the Scroll Area thumb disappear.
- **Fix:** a `@media (forced-colors: active)` block in default.css.

**M39. Caller `id` on parts is dropped.** Prism plus disclosure.
- Affected parts: Dialog, Popover, Tooltip and Preview Card popups; Menu Trigger and Popup; Combobox Root, Input, List and Item; Tabs Tab and Panel; Accordion and Collapsible triggers; the Field control; OTP; Navigation Menu; Slider thumbs. The docs say so; Number Field honours it. BU honours it everywhere (`useBaseUiId(idProp)`); doc-9 §9 expects it.
- These consequences are not in decision-62's list:
  - a server-rendered `Menu.Item command="show-modal" commandfor=…` can't open a `Dialog.Popup` (the ui-e2e fixture falls back to a raw `<dialog>`);
  - no `#hash` deep links to a tab panel or accordion item;
  - no external `label for` or aria refs.
- **Fix:** use `props.id ?? generated` for the element's own id, or an `id` on Root that seeds the generated ids. Otherwise record it in decision-62.

**M40. Collapsible and Accordion.Item: `onOpenChange(true)` on mount for items rendered open in the browser.** The platform behaviour is CONFIRMED (a `<details>` created open fires `toggle` in all 3 engines); Lumiose is SUSPECTED.
- **Fix:** report only real changes, as Accordion.Root does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M37: Forced color-scheme works in builds (light-dark lowering)
- [ ] #2 M38: Forced-colors styles for the theme's state indicators
- [ ] #3 M39: Parts honour a caller's id
- [ ] #4 M40: Collapsible/Accordion report no open change on mount
<!-- AC:END -->
