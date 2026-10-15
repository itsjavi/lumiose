---
id: TASK-366
title: Checkbox and Checkbox Group
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
ordinal: 367000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Checkbox (checked, indeterminate, form value, reset) and Checkbox Group with a parent checkbox.
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

2026-10-15 (Halo): implemented with TASK-365 (commit 084666fe and the docs commit); design, Field integration, the hydration finding and sizes are in TASK-365's notes. Screenshot: [form](../assets/task-365-form-errors.png).

## Design (technical)

Checkbox.Root is a native `<input type="checkbox">`; CheckboxGroup a `<fieldset>` whose checkboxes share `name` and are checked from the group's value. `checkbox/checkbox.script.ts` (0.48 kB brotli, shared with Radio Group and Switch) turns server HTML's `data-indeterminate` into the `indeterminate` property (no attribute exists), runs the parent checkbox (`data-parent`: checks every enabled box of its group, follows them as checked, mixed or unchecked; it has no `name`), and makes read-only inputs ignore clicks, Space and labels (`aria-readonly`). In islands the component sets `indeterminate` itself and computes the group's value from the DOM after the script ran.

## doc-9 section 10

[x] Space toggles; Enter does not (e2e on the switch; native). [x] Wrapping and `for` labels toggle (e2e). [x] Read-only: `aria-readonly`, a click, Space or a label click changes nothing (e2e). [x] Indeterminate exposed as mixed (e2e `toBeChecked({ indeterminate: true })`, from server HTML); a reset does not restore it (native: reset sets `checked`, not `indeterminate`); parents are recomputed after a reset. [x] An unchecked box submits nothing; the parent and disabled or fieldset-disabled boxes are not submitted (e2e without JavaScript). [ ] A `required` group (one at least): not offered yet (Base UI has none either; follow-up).
Section 17: [x] 1.4.1 checked is a ✓, mixed a dash, not only a colour. [x] 1.4.11 box border --lu-input (3:1), checked fill --lu-primary (5.2:1 light, 3.9:1 dark against the page). [x] 2.5.8 18px box in a 24px target. [x] axe light and dark (TASK-365's runs).

## Against Base UI and Zag

Base UI Checkbox: same props (`checked`, `defaultChecked`, `onCheckedChange`, `indeterminate`, `value`, `parent`, `readOnly`, `required`, `disabled`, `name`); no `Checkbox.Indicator` (the box is the input; draw it with `appearance: none`), `nativeButton`, `inputRef` or `uncheckedValue`. Base UI CheckboxGroup: `value`, `defaultValue`, `onValueChange`, `allValues`, `disabled` match; `name` added; the parent works without a controlled group. Zag checkbox: same states (indeterminate, readOnly, invalid) on a hidden native input; here the native input is the control.

## New public names (user review)

Checkbox.Root `checked`, `defaultChecked`, `onCheckedChange`, `indeterminate`, `value`, `parent`, `readOnly`; CheckboxGroup `value`, `defaultValue`, `onValueChange`, `allValues`, `name`; attributes `data-indeterminate`, `data-parent`; theme class `lu-checkbox`; exports `/checkbox`, `/checkbox-group`.
<!-- SECTION:NOTES:END -->
