---
id: TASK-367
title: Radio Group
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
ordinal: 368000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Radio Group with roving focus, arrow keys, form value and reset.
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

RadioGroup renders a `<fieldset role="radiogroup">` (an allowed role for a fieldset): its `Fieldset.Legend` names it, `disabled` is native, and its radios are native `<input type="radio">` sharing `name` (generated when left out, a Field's name inside a Field). The platform gives the roving tab stop, the arrow keys (move and select, skipping disabled radios), `required`, submission and reset; no script except read-only, from the shared checkbox script. Inside a Field the group gets `aria-describedby` and `aria-invalid`.

## doc-9 section 11

[x] `role=radiogroup` labelled by its legend (e2e). [x] Arrow keys move and select (e2e); Enter does not select (native). [x] One tab stop: the checked radio, or the first (e2e). [x] Disabled radios skipped (e2e); arrow direction in right-to-left is the browser's, not verified here. [~] "Selecting with arrow keys does not send clicks to ancestors" (BU): native radios fire a click on the radio they select; not changed. [x] Pressing a focused radio keeps focus (native). [x] A disabled checked radio is not submitted, no value when none is checked, `required` works (native; required e2e). [x] Native radios cover the rest.
Section 17: [x] 1.4.1 checked is a thick ring (a shape). [x] 1.4.11 circle border --lu-input, ring --lu-primary. [x] 2.5.8 24px target. [x] read-only: arrows and clicks do not change the checked radio (e2e).

## Against Base UI and Zag

Base UI RadioGroup/Radio: `value`, `defaultValue`, `onValueChange`, `name`, `disabled`, `readOnly`, `required`, Radio `value` and `disabled` match; no `Radio.Indicator`, `nativeButton`, `inputRef`, `form` on the group (use the radios' `form`). Zag radio-group: custom elements with a hidden input and roving focus in script; here the platform's.

## New public names (user review)

RadioGroup `value`, `defaultValue`, `onValueChange`, `name`, `required`, `readOnly`; Radio.Root `value`; theme class `lu-radio`; export `/radio-group` (exports `RadioGroup` and `Radio`; the docs page is radio-group.md, titled "Radio").
<!-- SECTION:NOTES:END -->
