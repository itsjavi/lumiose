---
id: TASK-457
title: Review the release-review fixes with the user
status: Done
assignee:
  - '@Lux'
created_date: '2026-10-16 12:33'
updated_date: '2026-10-16 21:19'
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
- [x] #1 The user decided each item, and the approved names and choices are recorded in the decisions and tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (user): don't push yet; push once the release-review fixes are merged and green, and ask then.

2026-10-16 (Lux), for the user's information, not a question: the Safari CSS target goes from 17.4 to 17.5 (decision-66 amended, TASK-441 M37). At 17.4 the minifier lowered light-dark() so that a subtree's color-scheme could never flip the default theme. Safari 17.4 is listed without the theme's light and dark colours.

2026-10-16 (Lux): item 7, an API proposal from TASK-441 M39 (Halo): a caller's `id` on Root, used as a later part's id.

Server rendering is one pass. A Trigger or Tab writes `popovertarget`, `commandfor` or `aria-controls` before its Popup or Panel renders, so a caller's `id` on the later part can't reach the server HTML.

What ships now (option b):
- Parts that nothing earlier points at honour a caller's `id`: triggers, tabs, items and thumbs.
- Popups and panels keep generated ids, documented on each component's page.

The proposal (option a): let Root take `id` as that part's id, the way NumberField.Root's `id` names its input, which the server knows in time. Covered parts: the Dialog, Popover, Tooltip, Preview Card and Menu popups, and the Tabs, Accordion and Collapsible panels. A part's own `id` there would then work in islands only. Not built until the user decides.

2026-10-16 (Beacon, from TASK-454 L32): a parity call for the user: Escape on a closed Combobox does nothing (the key goes on, so a parent dialog closes); Base UI clears the input and the selection. Keep ours (Escape never discards a value; Clear does) or follow Base UI?

## The user's answers (2026-10-16)

Asked one question at a time, each with a recommendation.

1. **Form `values` (TASK-430):** approved as built: the `values` prop, `FormValues`, and FormData in action data.
2. **Field's wrapper on `requestSubmit` and `reportValidity`:** keep it. Document it in field.md, with a test that the wrapped methods behave like the native ones.
3. **The M26 and M24 server-rendering limits:** keep them and document them.
4. **Root `id` for popups and panels:** not now.
5. **Escape on a closed Combobox:** follow Base UI and clear the input and the selection. This becomes a new task.
6. **Next steps:** the workers do the Escape change and the follow-ups (TASK-458 to TASK-464) in one more batch, while the user does the screen reader pass (TASK-361). Then Lux asks about publishing 0.1.0, after the pre-release security review.

Recorded in decision-62.
<!-- SECTION:NOTES:END -->
