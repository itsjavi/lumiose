---
id: TASK-368
title: Switch
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 16:54'
updated_date: '2026-10-15 21:36'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-353
  - TASK-365
priority: high
ordinal: 369000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Switch (role switch) with form value and reset.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Parts, props and events follow Base UI's anatomy within decision-62 (lu- tags, lowercase events, bind: by convention)
- [ ] #2 Unstyled: the package ships only the CSS the primitive needs to work (display, positioning, CSS variables), in one low-priority layer
- [ ] #3 Passes every item of the "UI primitives pitfall checklist" backlog doc (from Base UI and Zag/Ark) that applies, plus keyboard-contract and axe tests
- [ ] #4 A docs page with a type-checked example
- [ ] #5 Meets WCAG 2.2 AA (doc-9 section 17): axe with the WCAG A and AA tags passes closed and open, with the default theme, in light and dark, and the manual criteria that apply are checked and recorded
- [ ] #6 Its docs page in packages/ui/docs follows the component template (decision-64) and is listed in @lumiose/ui's llms.txt
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: the pitfall checklist is doc-9. The component gets its rules in the optional default theme (@lumiose/ui/themes/default.css, decision-62); the component itself stays unstyled.

2026-10-15 (user): @lumiose/ui meets WCAG 2.2 AA (decision-62, doc-9 section 17).

2026-10-15 (user): @lumiose/ui is agent-ready like lumiose (decision-64). The component's docs page lives in packages/ui/docs/<component>.md, follows dialog.md's sections (Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support, Related) and is listed in the UI llms.txt.

2026-10-15 (Halo): implemented with TASK-365 (commit 084666fe and the docs commit); see TASK-365's notes for Field and the shared script.

## Design (technical)

Switch.Root is a native `<input type="checkbox" role="switch">` (`<input switch>` is Safari-only): toggling, submission when on, `required`, reset and `disabled` are the platform's, and assistive technology announces a switch with its checked state. The shared checkbox script adds read-only. Inside a Field it takes the field's wiring.

## doc-9 section 12

[x] `role=switch` with its checked state (native), Space toggles (e2e), `aria-readonly` when read-only, `required` exposed natively. [ ] An "unchecked" value submitted when off: not offered (Base UI's `uncheckedValue`; follow-up). Native validation runs on submit. [x] `role=switch` on a checkbox, not `<input switch>`.
Section 17: [x] 1.4.1 on and off differ by the thumb's side, not only the track's colour. [x] 1.4.11 track --lu-input off (3:1), --lu-primary on; white thumb 3.8:1 on the light track, 4.9:1 on the dark one. [x] 2.5.8 40 by 24px. [x] axe light and dark (TASK-365's runs).

## Against Base UI and Zag

Base UI Switch: `checked`, `defaultChecked`, `onCheckedChange`, `value`, `readOnly`, `required`, `disabled`, `name` match; no `Switch.Thumb` (draw it with `::before`), `nativeButton`, `inputRef` or `uncheckedValue`. Zag switch: a hidden checkbox behind a custom control; here the checkbox is the control.

## New public names (user review)

Switch.Root `checked`, `defaultChecked`, `onCheckedChange`, `value`, `readOnly`; theme class `lu-switch`; export `/switch`.
<!-- SECTION:NOTES:END -->
