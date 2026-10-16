---
id: TASK-429
title: 'Field: show a form action''s error again when it repeats'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:12'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 427000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H3.

**H3. Field/Form (island): an action error that repeats after an edit is never shown again.** CONFIRMED in Chromium and Firefox; Prism re-verified.
- **Repro:** `/form/island`. Set Handle to "admin" and Save: the error shows. Edit to "admin2", back to "admin", and Save.
- **Observed:** the second POST returns 400 with the same message, but Error stays `hidden`, with no `aria-invalid` and no describedby. The submit fails silently.
- **Cause:** the signal values didn't change (true → true), so nothing re-applies what field.script removed on the edit. The script's `server` map stays false.
- **Violates:** WCAG 3.3.1; BU Form.test "focuses asynchronously replaced external errors".
- **Fix:** in field.tsx, an effect on the `form.errors()` identity re-shows the Error, re-asserts the aria attributes, and tells field.script that the server error is back.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Field: show a form action's error again when it repeats, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for fix batch 1 of the release review (the idle Beacon session; it may edit packages/ui and, for TASK-430, the form-action runtime in packages/lumiose/src/app).

2026-10-16 (Beacon): Fixed. Field.Root has an effect on the Form's `errors` (identity) and the field's messages: whenever an action's errors for the field arrive (a new actionData object, also with the same content), it fires `validitychange` on its `<lu-field>` with `detail.errors`. field.script.ts handles `validitychange` on the field itself: the server's verdict again (`server` map true), the message and `-invalid` Errors un-hidden, the messages written into the message Error's text node (an edit may have left the browser's message there), then render() puts back `aria-invalid` and `aria-describedby`. Before, the island's bindings saw the same values (true → true) and nothing re-applied what the script removed on the edit. Test: ui-e2e form.e2e.ts 'a form action's error that repeats (TASK-429)': admin, Save, edit to admin2, back to admin, Save → the Error shows with aria-invalid and describedby. Fails without the fix in Chromium (build), Firefox and WebKit; passes in all three. Docs: field.md (timing list, the script section).
<!-- SECTION:NOTES:END -->
