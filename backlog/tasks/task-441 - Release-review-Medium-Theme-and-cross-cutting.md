---
id: TASK-441
title: 'Release review, Medium: Theme and cross-cutting'
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 14:18'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- M38 done (dec08fa9): a @media (forced-colors: active) block at the end of default.css draws the state indicators in system colours (Chromium keeps author system colours there, forces transparent borders visible and drops shadows and plain backgrounds): switch thumb (ButtonText) and on state (Highlight), pressed toggle, the selected tab's bar (others' edges Canvas, so vertical tabs no longer all look selected; the Indicator in Highlight), progress and meter values (indeterminate segment with forced-color-adjust: none), the slider range, the scroll thumb and the highlighted menu item. e2e forced-colors.e2e.ts (computed styles; a small PNG reader, e2e/pixels.ts, checks that <progress>/<meter> values paint) fails without it in Chromium (5 tests) and Firefox (4); WebKit's emulation only matches the media query. theming.md documents it.
- M40 done (b03d7261): Collapsible and Accordion.Item keep the state they last reported, so the toggle a <details> created open fires reports nothing; real changes still report. Island fixtures render one open on demand; e2e fails without the fix (dev, build, Firefox).
- M37 and M39 wait on decisions, asked of Lux: M37 needs @lumiose/vite's cssTarget (Safari 17.5) or excluding light-dark from Lightning CSS lowering (Photon's area, decision-66): lowering puts var(--lightningcss-light/dark) into the theme's custom properties, which resolve on :root, so no subtree, inline or JS color-scheme can flip them and nothing in the theme can fix it. M39 is API shape: one-pass SSR writes a trigger's popovertarget/aria-controls before its popup or panel renders, so a caller id on the later part cannot reach it; proposed (b) honour id on parts nothing earlier points at and record the rest, with a Root id for the rest as a proposal.
<!-- SECTION:NOTES:END -->
