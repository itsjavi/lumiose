---
id: TASK-457
title: Review the release-review fixes with the user
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-16 12:33'
updated_date: '2026-10-16 13:07'
labels:
  - ui
  - review
milestone: m-12
dependencies: []
priority: high
ordinal: 455000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request (2026-10-15): run M12 batches autonomously and review the UI changes together at the end (TASK-400 did the first round). This task collects what the release-review fix batches (TASK-427 to TASK-456) leave for the user. The user approves names before they are recorded; AGENTS.md also asks for approval of consequential product decisions.

Items so far (fix batch 1):

1. **TASK-430, a public API in lumiose and @lumiose/ui.**
   - A failed action echoes the submission on request: `fail(400, { errors, values: form })`. Form takes `values` (type `FormValues`), and its controls use them as defaults by `name`.
   - Passwords, files, hidden inputs, OTP Fields and disabled controls are never filled.
   - Lumiose's data serializer now carries FormData (text entries only).
   - Proposed names: `values` and `FormValues`.
2. **TASK-439 M27 to M29, a technical choice worth the user's look.**
   - To tell a submit attempt from a silent `checkValidity()`, Field's script wraps `HTMLFormElement.prototype.requestSubmit` and `reportValidity` when it loads.
   - That is a global patch on every page that renders a Field.
   - The alternative is to drop the wrapper and accept that programmatic `requestSubmit()` and `reportValidity()` calls don't route errors into the field.
3. **TASK-439 M26 (no JavaScript).** A control's `aria-describedby` can name an Error that isn't rendered, because the server renders the control before its Errors. Beacon proposes keeping it, with docs recommending a message Error.
4. **TASK-438 M24.** The server can't put the selected option's label in the Combobox input, because the input renders before the options. The script fills it on load. Beacon proposes keeping it, documented.
5. **TASK-438 M23.** The announcements of Empty and Status move to the user's screen reader pass (TASK-361).
6. **Pushing.** Main is ahead of origin: the `--lu-` rename (TASK-426) and the fixes. A push needs the user's permission.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The user decided each item, and the approved names and choices are recorded in the decisions and tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (user): don't push yet; push once the release-review fixes are merged and green, and ask then.

2026-10-16 (Lux), for the user's information, not a question: the Safari CSS target goes from 17.4 to 17.5 (decision-66 amended, TASK-441 M37). At 17.4 the minifier lowered light-dark() so that a subtree's color-scheme could never flip the default theme. Safari 17.4 is listed without the theme's light and dark colours.
<!-- SECTION:NOTES:END -->
