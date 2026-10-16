---
id: TASK-361
title: UI test kit
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-16 09:19'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: medium
ordinal: 362000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike (removed in TASK-363; it remains in the git history), proposal and measurements in TASK-332's notes). Keyboard-contract and axe Playwright suites per component in CI, porting Timeless's contract cases; before @lumiose/ui 0.1.0, a screen reader pass (VoiceOver, NVDA) and Firefox and WebKit runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every component has keyboard-contract and axe suites in CI
- [ ] #2 The screen reader, Firefox and WebKit passes are recorded before 0.1.0
- [x] #3 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 8. No Spark or Photon session is running, and new sessions cannot start from an automated turn, so the idle Beacon session takes it. It may edit the files the task needs (runtime, Vite plugin, CI workflows, site-kit).

2026-10-16 (Beacon, batch 8): the Firefox and WebKit runs are in place (766d22e6). The screen reader pass is parked for the user (checklist below).

Setup:
- examples/ui-e2e/playwright.config.ts: `UI_E2E_BROWSERS=firefox,webkit` adds the `firefox` and `webkit` projects against the production build. Dev stays Chromium.
  - `pnpm --filter @lumiose-examples/ui-e2e test:e2e:browsers` runs them.
  - `UI_E2E_WS=ws://…` runs them remotely with `exposeNetwork: "<loopback>"`, for Linux's browsers from the Playwright Docker image. macOS's WebKit tabs only to fields (the system setting), which made most keyboard tests fail locally.
- CI: .github/workflows/ui-browsers.yml, one Linux job. It runs only when packages/ui, the fixture, packages/lumiose/src, packages/vite/src or the compiler change (path filter), plus workflow_dispatch. It caches its browsers and uploads test-results on failure. CI's e2e job keeps Chromium on every push.
- Docs: CONTRIBUTING (CI section) and packages/ui/README.

Results:
- Linux Firefox and WebKit: 729 passed, 21 skipped, 0 failed.
- Chromium: 728 passed, 22 skipped. The first runs had 84 failures (macOS) and then 45 (Linux).

Bugs found and fixed:
- **Menu and Combobox** told a resting pointer by `movementX/Y === 0`. Playwright's WebKit reports 0 for every move, so hover never highlighted. layer.ts `moved()` now compares positions, which is still what WebKit's keyboard-scroll moves have in common.
- **Toast swipes** used `setPointerCapture`, after which WebKit stopped dispatching Playwright's mouse. They also left text selected, and Firefox's next press dragged it (`pointercancel`).
  - Document listeners now follow a swipe.
  - A swipe clears the selection.
  - `[data-swiping]` gets `user-select: none` in lu.core.

Test fixes:
- `dragPath()` keeps drags inside the window: Firefox reports 0 past the edge and WebKit stalls.
- `axDescription` reads the aria-describedby text outside Chromium (CDP is Chromium-only).
- Select checks `appearance: base-select` and picks with `selectOption` in the classic select.
- Number Field types instead of using `fill`.
- The Tooltip toggle uses the keyboard: a press outside closes a tooltip.
- Taller viewports, and the Popover fixture's "Next step" moved out from under its popup, where a popup covered a control.
- The fixture's field input gets `min-inline-size: 0`, for 320px in Firefox.
- Avatar's no-JS check doesn't evaluate in Firefox.

Skips:
- Platform or test tool:
  - customizable select in Firefox and WebKit;
  - clipboard permissions in Firefox (OTP paste);
  - Tab past the page's end in headless Firefox (Popover);
  - WebKit's native radio group not wrapping past a disabled radio.
- Tasks for the owners:
  - TASK-416: Number Field, no commit on blur in Firefox and WebKit;
  - TASK-417: OTP overtype in WebKit;
  - TASK-418: Slider arrow keys in right-to-left in WebKit;
  - TASK-419: Select trigger without a name in Firefox;
  - TASK-420: Scroll Area without JavaScript in Firefox.

AC #1 (keyboard and axe suites in CI) and #3 (axe closed and open, light and dark, now in three engines) are checked. AC #2 waits for the screen reader pass.
**Screen reader pass (parked for the user: needs a human).** Run it before @lumiose/ui 0.1.0, with VoiceOver and Safari (macOS, iOS for the touch parts) and with NVDA and Firefox or Chrome (Windows). Use the examples/ui-e2e fixture pages (`pnpm --filter @lumiose-examples/ui-e2e dev`) and the /ui pages of the site. Record the date, the screen reader, the browser and versions, and any issue as a task.

For every component, check three things. It is announced with its role, its name and its state. Keyboard use (Tab, the arrows) announces each move. Nothing is announced twice, and nothing hidden is read.

- Dialog / Alert Dialog / Drawer:
  - on open: "dialog" (or "alert dialog") with the title, and the description;
  - focus stays inside; Escape and Close return focus to the trigger, announced;
  - the page behind is not reachable with the virtual cursor (inert).
- Popover / Preview Card / Tooltip:
  - Popover: the trigger reads as a button and is collapsed or expanded; the popup reads as a dialog with its title; focus moves in and back.
  - Tooltip: the trigger's description reads the tip without hovering (aria-describedby); the tip itself is not read twice.
  - Preview Card: the link reads normally; the card's content is reachable on focus.
- Menu / Context Menu / Menubar:
  - "menu button", collapsed or expanded; on open "menu" with the item count;
  - each item reads as a menu item; checkbox and radio items read their checked state;
  - submenu items read "submenu"; disabled items read "dimmed" or "unavailable";
  - Menubar: "menu bar", and each item as a menu item that has a popup.
  - Context Menu: Shift+F10 opens it at the focused area.
- Navigation Menu:
  - a "navigation" landmark with its name;
  - triggers are buttons, collapsed or expanded; links read normally, the current page as "current page";
  - with JavaScript off, the panels still open.
- Combobox / Autocomplete / Select:
  - Combobox and Autocomplete: "combo box", collapsed or expanded; arrows announce each option (aria-activedescendant) and whether it is selected; the status ("N results") is announced; chips read with their remove buttons.
  - Select: the platform's select, with its label and value.
- Tabs / Toolbar / Toggle Group:
  - "tab, selected, 1 of 3" while arrowing;
  - each panel reads with its tab's name;
  - the toolbar and the group are one tab stop, with each item's state ("pressed").
- Accordion / Collapsible: each trigger reads as a button (a summary) with expanded or collapsed; the heading level is kept for an accordion.
- Field / Fieldset / Form / Input / Number Field / OTP Field:
  - Field and Form: the label and description are read on focus; an error is read when it appears (aria-describedby, aria-invalid "invalid entry").
  - Fieldset: the legend names the group.
  - Number Field: "spin button" with the value and its text; increments are announced.
  - OTP Field: one text field named, its value read as typed, and "complete" or the error.
- Checkbox / Checkbox Group / Radio Group / Switch / Toggle:
  - Checkbox and Checkbox Group: checked, not checked or mixed (the parent checkbox).
  - Radio Group: "radio group" with its legend, "1 of 3".
  - Switch: "switch, on" or "off".
  - Toggle: "toggle button, pressed" or "not pressed".
- Slider / Progress / Meter:
  - Slider: "slider" with the value text, and each key's change.
  - Progress: "progress bar" with the value text, or busy and indeterminate.
  - Meter: "meter" (or a level indicator) with the value text.
- Toast: a polite toast is announced without moving focus; an alert one at once; F6 reaches the region; Escape closes the focused toast. The VoiceOver delay is covered by the word joiner (doc-9 §1).
- Scroll Area: the viewport is a named region and a tab stop only when it scrolls.
- Avatar / Separator:
  - Avatar: read once (the image's alt, or the fallback's label alone), never twice.
  - Separator: read as a separator, or skipped.

2026-10-16 (user, TASK-400 review): the ui-browsers workflow runs on UI path changes, as built, and its script and variable names are approved. The screen reader pass is the user's, after Prism's TASK-386 review.
<!-- SECTION:NOTES:END -->
