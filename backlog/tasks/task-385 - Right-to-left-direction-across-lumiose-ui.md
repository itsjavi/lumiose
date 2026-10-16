---
id: TASK-385
title: Right-to-left direction across @lumiose/ui
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-15 16:55'
updated_date: '2026-10-16 02:12'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
priority: medium
ordinal: 386000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Every primitive follows the document's or a container's dir (Base UI's Direction Provider): arrow keys, placement and slider direction flip in RTL. Lumiose has no provider component; read dir from the DOM.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [x] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [x] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [x] #4 A docs page with a type-checked example
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): audit and fixes. Every component reads the direction from the DOM (computed `direction` or `matches(':dir(rtl)')` in scripts), with no provider. Fixed: the default theme had `:dir(rtl)` rules that Lightning CSS (the production minifier) lowers to `:lang()` lists, which miss a `dir` attribute, so they worked in dev only: the vertical Tabs bar now uses logical properties (border-inline-end, border-start-start-radius), the Menu submenu arrow and the Progress indeterminate animation use a `:where([dir=rtl])` ancestor rule with a `[dir=ltr]` reset; no `:dir(` remains in the CSS. Number Field's scrub area reverses its horizontal travel in RTL. A numeric OTP Field renders `dir=ltr` (digits run left to right in RTL pages). Collapsible/Accordion chevrons are physical borders rotated, checked in RTL. Added an RTL e2e case per component that lacked one: Menubar, Context Menu (submenu opens to the left), Navigation Menu, Toast (viewport on the left), Tooltip (physical side kept), Select, Form (radio arrows), Combobox, Autocomplete (popup start aligned right), Number Field (leftward scrub), OTP Field, Progress, Popover hover and modal, Preview Card, Collapsible, plus production-CSS guards in tabs.e2e.ts and menu.e2e.ts. Not direction-dependent (recorded, no test): Avatar, Button, Dialog, Separator. Drawer and Toast swipes stay physical by design (documented). Docs: README 'Right to left' section, number-field, otp-field, progress. Follow-up for Photon/Lux: raise the CSS targets so Lightning CSS stops lowering `:dir()` (it affects any user CSS too). Commit 67b4485e.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Right to left across @lumiose/ui: every component reads dir from the DOM; RTL e2e cases for each component that lacked one (dev and build); theme RTL rules rewritten without `:dir()`, which Lightning CSS lowered to `:lang()` and broke in production; Number Field scrub and numeric OTP Field fixed for RTL; README 'Right to left' section. Commit 67b4485e.
<!-- SECTION:FINAL_SUMMARY:END -->
