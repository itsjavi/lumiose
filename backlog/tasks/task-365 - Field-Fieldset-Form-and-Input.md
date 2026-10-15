---
id: TASK-365
title: 'Field, Fieldset, Form and Input'
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
priority: high
ordinal: 366000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User decision 2026-10-15: @lumiose/ui reaches parity with Base UI's components before 1.0 (Base UI 1.9.0), unstyled, and verified against Base UI and Zag/Ark. Contract: decision-62. Field (label, description, error, validity state wired with aria-describedby and aria-invalid), Fieldset with a legend, Form (submission, server errors mapped to fields, works with form actions and submit()), and Input.
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

2026-10-15 (Halo): claimed (M12 fourth batch, branch claude/halo-m12c-4d6b9f).

2026-10-15 (Halo): implemented with TASK-366 to TASK-368 (commit 084666fe and the docs commit). Screenshots: [errors after a submit, light](../assets/task-365-form-errors.png), [island with a validate() message, dark](../assets/task-365-form-island-dark.png).

## Design (technical, decision-16)

- **Native first.** Input, Fieldset, Form, Checkbox, Radio and Switch render real `<input>`, `<fieldset>`, `<legend>` and `<form>`: submission, reset, `required` and the other constraints, a disabled fieldset and autofill are the platform's, in server HTML and without JavaScript.
- **Field** renders `<lu-field>` (not a defined element) and loads `field/field.script.ts` (1.0 kB brotli, decision-63). The script does not set `noValidate`: it cancels the `invalid` event of controls in a field that has an Error part, so the browser's bubble gives way to the field's errors where JavaScript runs and still reports problems without it. It focuses the first invalid control of the form in DOM order, applies `validationMode` timing (Base UI's `onSubmit` default, `onBlur`, `onChange`; a missing value waits for an edit), revalidates once shown, hides server errors once the value changes, and keeps `aria-invalid` and `aria-describedby` current.
- **Field.Error** is an `<output>`: without children it is the field's message slot (`for` the control), filled with the server's message or the browser's; with children it is a fixed message. `match` reads Base UI's prop; the script finds parts by ids derived from the field's (`<id>-control`, `-label`, `-description`, `-error`, `-error-invalid`, `-error-always`, `-error-<ValidityState key>`), with no part attribute (decision-62).
- **Server errors**: `Form errors={actionData()}` maps a message (or several) to each `Field.Root name`, rendered visible and linked in the HTML, so a form action's `fail()` works without JavaScript. `errors` is typed `object`, so an action's `interface Errors` fits.
- **Description linking**: the server writes a control's attributes before later siblings render, so a description after the control is linked only once the script (or the island) runs; a server error is known up front and linked in the HTML. Recorded in field.md.
- **validate** (island only: a function cannot reach a server page) sets the control's custom validity on every edit, so the browser blocks the submit and the Error shows the message.
- **Select** takes a Field's wiring (id, name, aria-describedby, aria-invalid). Combobox does not yet (follow-up).

## doc-9 results

Section 15 (Field): [x] label `for` the control. [x] description and errors in `aria-describedby` only while rendered and shown (a description after the control: once the script runs). [x] `aria-invalid` while an error shows. [x] Timing: a missing value waits for an edit or a submit; other problems show on blur with `onBlur`; once shown, revalidated on every edit (e2e). Stale async results: N/A, no async `validate`. [x] Submit: the browser's bubbles give way (cancelled `invalid`, the constraint API stays), focus goes to the first invalid control in DOM order (e2e), server errors clear on change (e2e, with and without JavaScript). [~] State attributes: `aria-invalid` and the platform's `:user-invalid`, `:invalid`, `:focus-within`, `:placeholder-shown`; no `data-dirty`/`data-touched`/`data-filled` (recorded difference). [x] Custom controls: lu-combobox's ElementInternals validity is read like a native control's.
Section 1 (applies to Field): [x] deterministic ids from `useId`; no references to ids not rendered (an Error id enters `aria-describedby` only while shown). [x] IME and pointer items: N/A (native controls).
Section 17: axe with the WCAG A and AA tags passes on /form before and after a failed submit and on /form/island, in light and dark (e2e). Manual: [x] 3.3.1 errors are text, linked with `aria-describedby`, the control marked `aria-invalid`. [x] 3.3.2 every control has a label. [x] 3.3.7 Redundant Entry: N/A (no multi-step flow). [x] 2.4.3 a failed submit focuses the first invalid control. [x] 2.4.7 2px ring on inputs, checkboxes, radios and switches (e2e). [x] 2.5.8 every control at least 24 by 24 (e2e; checkbox and radio draw an 18px box inside a 24px target). [x] 1.4.10/1.4.12 the form within 320px with text spacing (e2e). [x] 1.4.3 error text: --lu-destructive on the background in light (4.8:1), #f87171 in dark (7.9:1, the destructive red is 4.3:1 there). [x] 3.2.2 editing never submits.

## Against Base UI 1.9 and Zag/Ark

Base UI Field: same parts (Root, Label, Control, Description, Error) and props (`name`, `disabled`, `invalid`, `validate`, `validationMode`, Error `match`); not offered: `Field.Validity`, `Field.Item`, async `validate`, `validationDebounceTime`, `dirty`, `touched`, `actionsRef`, the `data-*` state attributes. Base UI Form: `errors` and `validationMode` match; `onFormSubmit`/`actionsRef` replaced by native submission and Lumiose's form actions; Base UI sets `noValidate`, here validation stays on. Base UI Fieldset: Legend is a native `<legend>`, not a `<div>`. Base UI Input: same, plus `bind:value`. Ark's field (use-field.ts) detects parts with a MutationObserver; here ids are derived and the script reads them.

## Hydration bug found (for Photon or Spark; not filed)

A component's `children` whose first part is a component and the next a different element can fail to hydrate (LUM4006, the island renders on the client). Repro 1 (no @lumiose/ui): `function B() { return <b>c</b>; } const NS = { P: () => <p>x</p> }; function Wrap(props) { return <section>{props.children}</section>; }` then `<Wrap><B /><NS.P /></Wrap>` in a `client:load` island; `<Wrap><NS.P /><B /></Wrap>`, `<Wrap><B /><B /></Wrap>` and `<div><B /><p>x</p></div>` hydrate. Repro 2: `<Field.Root name="a"><Field.Control /><Field.Description>d</Field.Description></Field.Root>` in an island: hydration's claim log shows the Description wanting `P` at index 1 of `LABEL,INPUT,P,OUTPUT`, i.e. the control's template never claimed its server `<input>` (a Checkbox.Root in the same place hydrates). Same family as the fixed TASK-234. Workaround in the fixture: the control last in its field, the groups last in the form; docs examples with a Field are server-rendered.

## New public names (user review, TASK-400)

Field: parts `Root`, `Label`, `Control`, `Description`, `Error`; Root props `name`, `disabled`, `invalid`, `validationMode` (`"onSubmit" | "onBlur" | "onChange"`), `validate`; Error `match` (`true` or a `ValidityState` key); types `FieldValidate`, `FieldErrorMatch`, `ValidationMode`; element `lu-field` with attribute `validation-mode`; ids `<id>-control`, `-label`, `-description`, `-error`, `-error-invalid`, `-error-always`, `-error-<key>`. Fieldset: `Root`, `Legend`. Form: `errors`, `validationMode`; type `FormErrors`. Input: `value`, `defaultValue`, `onValueChange`. Theme classes `lu-field`, `lu-input`, `lu-fieldset`. Exports `/field`, `/field.css`, `/fieldset`, `/form`, `/input`. Fixture: `UI_E2E_PORT` moves the ui-e2e servers.

## Sizes (brotli)

Field script 1.03 kB (2.60 min / 1.19 gzip); Field component JS 2.05 kB; field.css 0.07 kB. Fieldset 0.18 kB, Form 0.22 kB, Input 0.41 kB of component JS, no script, no CSS. Theme 2.72 kB with every component.

## Follow-ups (proposed, not created)

- The hydration bug above (Photon/Spark), with both repros.
- Combobox inside a Field: its Input should take the field's id and ARIA references (Select does).
- Field: async `validate` with stale-result handling; `Field.Validity`; state attributes if the user wants Base UI's `data-*` names.
- apps/web: add the new pages (and Combobox, Select) to `PAGES` and `OPEN_DEMOS` in e2e/a11y.e2e.ts (Beacon's file).
- Playwright's `toHaveAccessibleDescription` drops an `<output>`'s text (Chromium includes it); the ui-e2e helper `axDescription` reads Chromium's computation.
<!-- SECTION:NOTES:END -->
