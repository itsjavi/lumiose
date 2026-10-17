---
id: TASK-473
title: 'Security review, Low: @lumiose/ui scripts (L8 to L13)'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:20'
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
- [x] #1 L8: dialog.script escapes ids
- [x] #2 L9: form reads go through HTMLFormElement.prototype getters (no DOM clobbering)
- [x] #3 L10: the prototype wrapper is idempotent, feature-checked and keeps the native method's name
- [x] #4 L11: OTP looks up validation types with Object.hasOwn
- [x] #5 L12: invalid Intl options fall back instead of throwing
- [x] #6 L13: Tabs scopes its aria-controls lookup
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-17): L8 dialog.script finds the trigger by comparing commandfor with the id (no selector built from the id; happy-dom's selector parser rejects escaped quotes, browsers would take CSS.escape, the comparison works everywhere), and skips it without an id. L9 every clobberable form member read goes through the prototypes: elements/querySelectorAll in field.script and checkbox.script, elements in dialog.script, requestSubmit in otp-field.script and combobox.script, reportValidity and add/removeEventListener in field.tsx and form/reset.ts (island code, new form/native.ts). Scripts keep their own copies, as OTP's digits do: a shared module would be a chunk of its own. checkbox.script and field.script became modules (export {}), as dialog.script is. L10 the requestSubmit/reportValidity wrappers are installed once per page (Symbol.for guard on the prototype), keep the native names, and skip a missing method. L11 OTP validation-type uses Object.hasOwn. L12 number-field's formatter and slider's formatValues drop refused options, then a refused locale. L13 <lu-tabs> shows and hides only its own role=tabpanel children with the id. Tests: dialog/otp/number-field/slider/tabs script DOM tests and a new field.script.dom.test.ts (L10) fail on the old code; happy-dom does not shadow form members by control name, so L9 has a ui-e2e fixture (/form/clobber, e2e/clobber.e2e.ts: Field focus, unchecked value, parent after reset, OTP auto-submit), whose four tests fail on the old scripts in Chromium. Docs: Intl fallback (number-field.md, slider.md), unknown validationType (otp-field.md), panels inside their Root (tabs.md); script sizes brought current (combobox 5.4, field 1.7, number-field 2.6, otp-field 1.5 kB brotli).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The @lumiose/ui scripts no longer build a selector from a dialog id, read every form member through the prototypes (DOM clobbering), wrap requestSubmit/reportValidity once with their names, look up OTP validation types with Object.hasOwn, fall back from refused Intl options and locales, and keep Tabs to its own panels; unit tests plus a ui-e2e clobbering fixture, docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
