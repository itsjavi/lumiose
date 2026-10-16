---
id: TASK-435
title: 'Islands: bound values follow a form reset'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:08'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 433000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H9.

**H9. Form controls in islands: a native form reset leaves `bind:` signals stale.** Input, Checkbox, Switch, RadioGroup, CheckboxGroup, Number Field, OTP Field, Slider, Combobox, Autocomplete and Select. CONFIRMED in dev and build (3 reviewers independently).
- **Repro:** `/form/island`, change every control, click Reset. The DOM shows the defaults while the signals keep the edited values. No `on*Change` fires.
- The OTP docs example (`disabled={code().length < 6}`) leaves Verify enabled on an empty field.
- **Violates:** the `bind:` contract (decision-62); Zag `trackFormControl` → `onFormReset`.
- **Fix:** each Root listens for its form's `reset` and, a task later, reports the reset value through `onValueChange`/`onCheckedChange` when it differs. The custom elements could fire `input`/`change` from `formResetCallback`/`#onReset`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Islands: bound values follow a form reset, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).
<!-- SECTION:NOTES:END -->
