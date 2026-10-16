---
id: TASK-473
title: 'Security review, Low: @lumiose/ui scripts (L8 to L13)'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: medium
ordinal: 471000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**@lumiose/ui scripts (Beacon and Halo)**

- **L8. Unescaped selector in dialog.script.** `packages/ui/src/dialog/dialog.script.ts:253` puts `dialog.id` into a selector without `CSS.escape`. The script runs for every `<dialog>` on the page.
  - `id='a"b'` throws and focus isn't restored; a crafted id moves focus to another element. Confirmed.
  - Fix: `CSS.escape`, and skip the lookup without an id.
- **L9. DOM clobbering.** `field.script.ts:219,331` and `checkbox.script.ts:116,168,171` read `form.elements`/`form.querySelectorAll`. A control named `elements` makes `firstInvalid` throw (confirmed), and Field's focus handling falls back to native. Submission stays blocked.
  - Fix: read through the `HTMLFormElement.prototype` getters.
- **L10. The field.script prototype wrap has no idempotence guard.** `field.script.ts:193-204`: each loaded copy (HMR, two bundle versions) wraps the previous wrapper. Behaviour stays correct: no validation bypass, no double submit, no CSP violation.
  - The wrapper is detectable (`name` is `"value"`, a non-native `toString`), and it would define a broken method where `requestSubmit` is missing.
  - Fix: a `Symbol.for` guard; feature-check `native`; keep the method's name.
- **L11. OTP looks `validation-type` up on a plain object.** `otp-field.script.ts:142,156`: `"constructor"` returns a function, and the field throws on every input. Static.
  - Fix: `Object.hasOwn`.
- **L12. Invalid `Intl` options from attributes throw outside `try`.** `number-field.script.ts:151-160` and `slider/format.ts:15`: `format='{"style":"currency"}'` breaks the control (confirmed for number-field).
  - Fix: catch and fall back.
- **L13. Tabs resolve `aria-controls` document-wide and toggle `hidden`.** `tabs.script.ts:163`: injected `lu-tabs` markup could hide any element by id. Static.
  - Fix: scope the lookup, as `collapsible/panel.ts` does.
-
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 L8: dialog.script escapes ids
- [ ] #2 L9: form reads go through HTMLFormElement.prototype getters (no DOM clobbering)
- [ ] #3 L10: the prototype wrapper is idempotent, feature-checked and keeps the native method's name
- [ ] #4 L11: OTP looks up validation types with Object.hasOwn
- [ ] #5 L12: invalid Intl options fall back instead of throwing
- [ ] #6 L13: Tabs scopes its aria-controls lookup
<!-- AC:END -->
