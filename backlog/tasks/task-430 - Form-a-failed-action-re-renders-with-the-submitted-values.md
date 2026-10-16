---
id: TASK-430
title: 'Form: a failed action re-renders with the submitted values'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:25'
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
- [x] #1 Form: a failed action re-renders with the submitted values, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).

2026-10-16 (Beacon): Fixed, opt-in and explicit. Automatic echo was rejected: the runtime cannot tell a password from other text in a FormData, and everything it echoes is embedded in the re-rendered page (data-l-action), so the action decides what goes back. API (proposals for the user's review): (1) @lumiose/ui Form `values?: FormData | URLSearchParams | Record<string, string | string[]>`: the controls take them as their defaults by name (the control's, or its Field's): Input/Field.Control text, Autocomplete text, Select, Number Field, Slider, Checkbox and Switch checked (a name the submission left out means unchecked), Checkbox Group, Radio Group and Combobox selections. Controlled controls (value / bind:) keep theirs; passwords, files, hidden inputs, OTP Fields and disabled controls (own disabled, the Field's, or a disabled Fieldset.Root, which masks `values` for its content) are never filled. Helper useFormValues(name, disabled) in field/context.ts. (2) lumiose's data serializer (server/serialize.ts, island props and actionData) carries FormData as its text entries (tag F; files left out), so `return fail(400, { errors, values: form })` works after a no-JS post, in islands and with submit(); jsx-runtime's island prop type accepts FormData. Docs: form.md (values prop, the rules, the example now fails with { errors, values: form }, the secrets note), data-and-actions.md ('Keeping what the user entered'), islands.md, LUM4002, coming-from/nextjs.md. Fixture /form: the action fails with { errors, values: form }. Tests: packages/ui form.test.tsx (server HTML of every control with a FormData and with an object; passwords, hidden, disabled and a disabled fieldset not filled; defaults without values); serialize.test.ts (FormData round trip); ui-e2e form.e2e.ts 'a failed action keeps what the user entered (TASK-430)' with and without JavaScript: fill every control, the taken username, submit → the error and every control as left. Fails without the fix (Chromium build), passes in Chromium dev and build, Firefox and WebKit. Not done: a bound (bind:) control in an island posted natively keeps its signal's value, by design.
<!-- SECTION:NOTES:END -->
