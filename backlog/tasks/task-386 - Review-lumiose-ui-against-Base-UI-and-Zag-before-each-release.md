---
id: TASK-386
title: Review @lumiose/ui against Base UI and Zag before each release
status: Done
assignee:
  - '@Prism'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 10:08'
labels:
  - ui
  - review
milestone: m-12
dependencies: []
priority: high
ordinal: 387000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Before each @lumiose/ui 0.x release and before its 1.0: an independent review of every shipped primitive against Base UI's and Zag/Ark's behaviour and tests, and the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark), run in the browser (keyboard, pointer, touch emulation, RTL, nested layers). Prism is read-only: it returns findings to Lux, who records them as tasks. The checklist is updated with what each review finds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each release has a recorded review with its findings as tasks
- [x] #2 The pitfall checklist is updated after each review
- [x] #3 Each review includes a WCAG 2.2 AA audit with its findings as tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17). The release review includes a WCAG 2.2 AA audit of the shipped primitives and the default theme.

## Review for 0.1.0 (Prism, 2026-10-16)

Prism reviewed all 37 components on main 949db0a3, in Chromium 153, Firefox 155 and WebKit 26.6 on Linux (Playwright Docker), plus Firefox 137 for the fallback paths, mostly in production builds. It found 86 issues: 9 High, 40 Medium, 37 Low, none Critical. Every High and most Mediums were confirmed by a probe in a browser.

**Tasks:**
- TASK-427 Layers: one Escape closes one layer when a layer opens without user activation
- TASK-428 Size anchored popups to the space beside their trigger
- TASK-429 Field: show a form action's error again when it repeats
- TASK-430 Form: a failed action re-renders with the submitted values
- TASK-431 Combobox: aria-required on the input
- TASK-432 OTP Field: clean, complete and auto-submit only after IME composition ends
- TASK-433 Navigation Menu: nested Root keeps its parent open; closeOnClick closes every level
- TASK-434 Preview Card: return focus to the link when the card closes with focus inside
- TASK-435 Islands: bound values follow a form reset
- TASK-436 Release review, Medium: Layers and overlays
- TASK-437 Release review, Medium: Menus, toolbars, tabs
- TASK-438 Release review, Medium: Combobox, Autocomplete, Select
- TASK-439 Release review, Medium: Field, Form, form controls
- TASK-440 Release review, Medium: Number Field, OTP Field
- TASK-441 Release review, Medium: Theme and cross-cutting
- TASK-442 Release review, Low: Toast
- TASK-443 Release review, Low: Disclosure
- TASK-444 Release review, Low: Scroll Area
- TASK-445 Release review, Low: Avatar
- TASK-446 Release review, Low: Field and Checkbox
- TASK-447 Release review, Low: Number Field
- TASK-448 Release review, Low: OTP Field
- TASK-449 Release review, Low: Slider
- TASK-450 Release review, Low: Button
- TASK-451 Release review, Low: Navigation Menu
- TASK-452 Release review, Low: Toolbar and Menu
- TASK-453 Release review, Low: Placement and Dialog
- TASK-454 Release review, Low: Combobox and Select
- TASK-455 Release review, Low: Theme and test kit
- TASK-456 Release review, Low: Prism's cross-cutting

**WCAG 2.2 AA audit summary:**
| SC | Result | Failures |
| --- | --- | --- |
| 1.3.1 / 4.1.2 Info, Name/Role/Value | Fail | Combobox required (H5); CheckboxGroup and RadioGroup in a Field (M25, M26); disabled Toolbar triggers (M13); masked OTP (M33). Everything else passes in Chromium's AX tree. |
| 1.4.3 Contrast | Pass | Lowest: destructive 4.83, muted 5.10/5.81, placeholder 5.61. Builds fail only with a forced scheme (M37: 2.39). |
| 1.4.4 / 1.4.10 Resize, Reflow | Fail | Popups at 200%, 640x400 and 320x256 (H2). 320x640 passes. |
| 1.4.11 Non-text Contrast | Pass | Lowest: input on muted 3.08 (dark). Exception: disabled menu-item ring (L34). |
| 1.4.12 Text Spacing | Pass | All pages and popups at 320x640. |
| 1.4.13 Content on Hover | Pass, with caveats | Tooltip and Preview Card pass. A hover popover in a dialog: Escape also closes the dialog (H1). Wide navigation panels (L25). |
| 2.1.1 / 2.1.2 Keyboard | Fail | Nested Navigation Menu (H7); Toolbar without JS (M12); roving stop lost (M11). No traps. |
| 2.4.3 Focus Order | Fail | Preview Card Escape (H8); toast limit (M9); vertical Toolbar with a Menu (M14); no focus after server errors (M27). |
| 2.4.7 Focus Visible | Pass | 176 stops, light and dark; rings 4.7:1 or more. |
| 2.4.11 Focus Not Obscured | Fail | Persistent toast (M10); open non-modal popover (M2); off-screen menu items at 200% (H2). |
| 2.5.1 / 2.5.7 Gestures, Dragging | Pass | Every swipe, drag and long press has an alternative. |
| 2.5.3 Label in Name | Pass | |
| 2.5.8 Target Size | Minor fail | Scroll Area scrollbars (L7); a fixture link (L35). Checkbox, radio and chip remove are exactly 24. |
| 3.2.1 / 3.2.2 On Focus, On Input | Pass, with caveat | OTP autoSubmit fires mid-IME (H6). Document a warning for autoSubmit. |
| 3.3.1 / 3.3.2 Errors, Labels | Fail | Repeated server error hidden (H3); required combobox (H5). |
| 3.3.7 Redundant Entry | Fail | Failed action clears entries (H4). |
| 4.1.3 Status Messages | Partial | Toast passes (word joiner). Combobox Status and Empty (M22, M23); `<output>` over-announcement (M31). |
| Beyond AA | Fail | Forced colors (M38). Reduced motion passes. |

**Checked and fine (beyond the e2e suites):**
**Nesting** (`nest`, 3 engines, build):
- Popover > dialog > menu: a hover-opened submenu, the menu, the dialog and the popover each close one per Escape, and focus returns at every level.
- Combobox list, then the dialog.
- A hover popover and a tooltip inside the modal close alone after a click. H1 is the second-hover case.
- A press inside the dialog closes only the inner popover; a backdrop click closes only the dialog.
- A menu item opening a second modal returns focus to the menu trigger on close.
- The customizable select in a dialog closes first in Chromium and WebKit.

**Server HTML:** 57 fixture pages in dev, build and no-JS have no duplicate ids, no dangling `aria-*`/`for`/`commandfor`/`popovertarget` refs, and no console errors.

**Strict CSP** (`lumiose({ csp: "strict" })`, build, 3 engines):
- every component script carries the nonce;
- style props become nonce'd rules, and scripts set styles through the CSSOM;
- no violations; anchoring and the Tabs indicator work.

**Script takeover:** a menu opened natively before menu.script loads is adopted (keys, Escape, outside press) in Chromium and Firefox.

**Firefox 137 fallbacks** (no invokers, anchor positioning, closedby or CloseWatcher):
- the dialog opens through the polyfill;
- Escape, the backdrop and Close close it, and focus returns;
- Menu is placed by place.ts below its trigger, and keys work;
- Popover side=right placement and outside press work;
- the tooltip is a manual-popover fallback;
- the combobox list is placed;
- Navigation Menu, Drawer, Toast and Accordion `details[name]` work;
- no page errors.

**By the reviewers:** islands (dev and build) for Dialog, Popover, Menu, Menubar and Tabs; touch for Dialog, Popover and Menu; typeahead; LinkItem modifiers; Context Menu long press; Menubar keys and RTL; reduced motion; 1.4.3 and 1.4.12 across the theme; focus visible on 176 stops.

**Not checked:**
- **Screen readers:** VoiceOver, NVDA and JAWS (TASK-361's pass is the user's). Without them, the VoiceOver word joiner, live-region timing and the heading in `<summary>` in Firefox and WebKit stay unverified.
- **Accessibility trees:** only Chromium's (CDP). Firefox and WebKit have none in Playwright.
- **Real devices:** iOS Safari (zoom M35, inputmode M36, long-press callout, scroll lock), Android (the back gesture with CloseWatcher grouping), real Windows High Contrast, macOS Safari and Firefox button-focus quirks, and real browser zoom (emulated with viewports).
- **Safari before 26:** the old Playwright WebKit (18.4) runs with experimental features (its anchor positioning misplaces menus over the trigger), and it ignores Escape on a bare native `<dialog>`, so it doesn't represent Safari 18. The Safari-only fallback paths (closedby click, the invoker polyfill, the hint fallback, the no-CloseWatcher Escape path) ran only in Firefox 137, not in a Safari.
- **Native pickers:** classic select pickers in Firefox and WebKit, real IMEs (except Chromium's CDP IME) and real autofill (simulated with Base UI's event sequences).
- **Need a custom island:** L4, L5 and M40's Lumiose half could not be checked without writing an island, which the read-only rule prevents.
- **Layout:** layout shift from the scroll lock (headless scrollbars are overlays).
- **Not attempted:** find-in-page automation; multi-touch on two range thumbs.

doc-9 gained section 18 with this review's checklist additions.

2026-10-16 (Lux): the 0.1.0 review is recorded with its 86 findings as TASK-427 to TASK-456, and doc-9 gained section 18. Decision-62 makes the review a standing step before each @lumiose/ui release, so the next release gets a new review task.
<!-- SECTION:NOTES:END -->
