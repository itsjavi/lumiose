---
id: TASK-431
title: 'Combobox: aria-required on the input'
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
ordinal: 429000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H5.

**H5. Combobox: required is not exposed to assistive technology.** CONFIRMED in Chromium's AX tree and server HTML.
- `required` sits on `<lu-combobox>`, which has no role. `input[role=combobox]` gets no `aria-required`, inside or outside a Field. Autocomplete inside a Field does get it.
- **Violates:** WCAG 4.1.2, 1.3.1, 3.3.2; BU ComboboxInput `aria-required`.
- **Fix:** the Input renders `aria-required` from Root's context, and the script's `#sync` follows the attribute.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Combobox: aria-required on the input, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).
<!-- SECTION:NOTES:END -->
