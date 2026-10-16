---
id: TASK-430
title: 'Form: a failed action re-renders with the submitted values'
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
ordinal: 428000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H4.

**H4. Form: a failed action clears every entry.** Server-rendered `/form`, JS on and off. CONFIRMED.
- **Repro:** fill every control, use the taken username, submit.
- **Observed:** "That username is taken." comes back, and every control is back at its default. form.md's example teaches this pattern, and there is no API to restore the submitted values. TASK-365 marked 3.3.7 N/A, but re-entry after a failed submit is the same process.
- **Violates:** WCAG 3.3.7.
- **Fix:** have `fail()`/actionData echo the submitted FormData, and let the form controls use it as defaults by `name`; or add a Form `values` prop. Update form.md. Owners: Nova (actions) and Halo.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Form: a failed action re-renders with the submitted values, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).
<!-- SECTION:NOTES:END -->
