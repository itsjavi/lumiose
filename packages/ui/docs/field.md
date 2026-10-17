# Field

> A form field: a label, a native control, a description and its errors, wired with `for`, `aria-describedby` and `aria-invalid`, after Base UI's Field. Validation is the browser's constraint validation (`required`, `type`, `pattern`, `minlength`…); a 1.7 kB script shows it in the field's Error parts at the right time, instead of the browser's bubble, and focuses the first invalid field on submit. A Form's server errors render in the HTML, so they work without JavaScript. In an island, `validate` adds checks of your own, async ones included, and `Field.Validity` renders from the field's validity.

```ts
import { Field } from "@lumiose/ui"; // or "@lumiose/ui/field"
import "@lumiose/ui/field.css"; // makes <lu-field> a block, keeps hidden errors hidden
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Field.Root>
  <Field.Label />
  <Field.Control />
  <Field.Description />
  <Field.Error />
  <Field.Validity />
</Field.Root>
```

| Part          | Renders                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`        | `<lu-field>`, a block around the other parts, with `validation-mode`.                                                                        |
| `Label`       | `<label for="…">`, pointing at the control.                                                                                                  |
| `Control`     | `<input>`: [Input](input.md), with the field's `id`, `name`, `aria-describedby` and `aria-invalid`.                                          |
| `Description` | `<p>` that describes the control; several get ids of their own, and the control is described by each.                                        |
| `Error`       | `<output hidden>`: without children, the field's message (`for` the control); with children, your message. Shown while the field is invalid. |
| `Validity`    | No element: what its function child returns for the field's validity, in an island.                                                          |

Instead of `Field.Control`, a field can hold a [Checkbox](checkbox.md), a [Switch](switch.md), a
[Select](select.md), a [Radio Group](radio-group.md), a [Checkbox Group](checkbox-group.md), a
[Combobox](combobox.md), an [Autocomplete](autocomplete.md), a [Number Field](number-field.md) or a
[Slider](slider.md): they take the field's wiring the same way (a Combobox and an Autocomplete
through their input). A Radio Group or Checkbox Group takes it as a group: `Field.Label` names the
group (`aria-labelledby`, as there is no single radio or checkbox for its `for`), and the group,
not each control, gets `aria-describedby` and `aria-invalid`.

## API

### Field.Root

| Prop                     | Type                                           | Default      |                                                                                                                                                                |
| ------------------------ | ---------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                   | `string`                                       |              | The control's `name` (unless it has its own), and the key of the field's errors in the Form's `errors`.                                                        |
| `disabled`               | `boolean`                                      | `false`      | Disables the control.                                                                                                                                          |
| `invalid`                | `boolean`                                      | `false`      | Marks the field invalid, as a server error does: its Error shows and the control gets `aria-invalid`, until the value changes.                                 |
| `validationMode`         | `"onSubmit" \| "onBlur" \| "onChange"`         | `"onSubmit"` | When errors show: after a submit attempt, also when the control loses focus, or as soon as it is edited. Once shown, they follow the value.                    |
| `validate`               | `(value: string \| boolean) => string \| null` |              | Your own check, run on every edit in an island: return a message when the value is invalid. It becomes the control's custom validity. It may return a promise. |
| `validationDebounceTime` | `number`                                       | `0`          | How long typing must pause before `validate` runs, in ms: fewer server checks while the user types.                                                            |

`Root` passes `class`, `style` and other element props to `<lu-field>`. A Form's `validationMode`
applies to the fields that set none.

### Field.Error

| Prop       | Type                          | Default |                                                                                                        |
| ---------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `match`    | `keyof ValidityState \| true` |         | Shows only for that problem (`"valueMissing"`, `"typeMismatch"`, `"tooShort"`, …), or always (`true`). |
| `children` | `JSX.Element`                 |         | Your message. Without children, the Error shows the server's message or the browser's.                 |

### Async validate

`validate` may return a promise of the message: a check on the server, such as whether a username
is taken.

- **The latest edit wins.** Each edit starts a new check; an older check that settles later is
  dropped, so a slow answer never overwrites a newer one.
- **While it runs**, the control has no custom error (the last verdict was about another value),
  `<lu-field>` has `data-validating`, and `Field.Validity` reports `validating: true`. When it
  settles, its message becomes the control's custom validity, and the field shows it if it shows
  its errors by then (with `validationMode="onChange"`, at once).
- **A submit that comes first is not blocked**, as in Base UI: validate on the server too (a
  Form action's `fail()`). A check that rejects (the network) counts as no error.
- **One check per value.** The `change` a blur fires after an edit does not check the same value
  again; `validationDebounceTime` waits for a pause in typing before it checks. A submit attempt
  inside that pause runs the waiting check first: a synchronous `validate` that fails stops the
  submission and shows its message (an async one, as above, does not block it).
- The check runs once, quietly, when the island starts and after a form reset (`Field.Validity`
  stays unchecked).

### Field.Validity

| Prop       | Type                                         |                                                    |
| ---------- | -------------------------------------------- | -------------------------------------------------- |
| `children` | `(state: FieldValidityState) => JSX.Element` | Renders from the state, again whenever it changes. |

`FieldValidityState` holds `validity` (the control's `ValidityState` keys, with `valid` `null`
until the first check, or `false` from a server error), `error` (the first problem's message, or
`""`), `errors` (every message: the server's, or `error`), `value` (the control's value, or
`checked`) and `validating` (an async `validate` is running). It updates on every edit, blur and
submit attempt, whatever the `validationMode`, and when a `validate` result or a server error
arrives; a form reset makes it unchecked again. On the server, and without JavaScript, it renders
the unchecked state (or the server's error) once.

### Field.Control

[Input](input.md)'s props: every native `<input>` prop, plus `value`, `defaultValue`,
`onValueChange` and `bind:value`.

### The other parts

`Label` and `Description` take the props of the element they render (`class`, `style`, `aria-*`)
and pass them through; their `id` and `for` stay the field's.

**Differences from Base UI's Field.** The control is native and so is validation: `validate`
returns one message (not a list) and gets no other form values, and there is no `dirty`, `touched`,
`actionsRef` or `Field.Item`. State is exposed the platform's way, `aria-invalid` on the control
and `:user-invalid`, `:invalid`, `:focus-within` in CSS, rather than Base UI's `data-dirty`,
`data-touched` and friends. `Field.Error` renders an `<output>`, not a `<div>`.

## Example

An email field in a server-rendered page, with no island:

```tsx check
import { Field } from "@lumiose/ui";

export function EmailField() {
  return (
    <form method="post">
      <Field.Root name="email" validationMode="onBlur" class="lu-field">
        <Field.Label>Email</Field.Label>
        <Field.Control type="email" required autocomplete="email" class="lu-input" />
        <Field.Description>We never share it.</Field.Description>
        <Field.Error match="valueMissing">Enter your email.</Field.Error>
        <Field.Error match="typeMismatch">Enter an email like ada@example.com.</Field.Error>
      </Field.Root>
      <button class="lu-button">Subscribe</button>
    </form>
  );
}
```

With a form action, a [Form](form.md)'s `errors` (the data the action passes to `fail()`) show in
the field of the same `name`, in the page the server renders back:

```tsx check
import { Field, Form } from "@lumiose/ui";

export function UsernameField(props: { errors?: { username?: string } }) {
  return (
    <Form method="post" errors={props.errors}>
      <Field.Root name="username" class="lu-field">
        <Field.Label>Username</Field.Label>
        <Field.Control required minlength={3} class="lu-input" />
        <Field.Error />
      </Field.Root>
      <button class="lu-button">Sign up</button>
    </Form>
  );
}
```

In an island, an async `validate` asks the server while the user types, and `Field.Validity`
shows its state:

```tsx check
import { Field } from "@lumiose/ui";

const TAKEN = ["admin", "lumiose"];

/** A server check, here a delay and a list: a `fetch` in a real form. */
async function available(value: string | boolean) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return TAKEN.includes(String(value)) ? "That handle is taken." : null;
}

export function HandleField() {
  return (
    <Field.Root
      name="handle"
      validationMode="onChange"
      validationDebounceTime={300}
      validate={available}
      class="lu-field"
    >
      <Field.Label>Handle</Field.Label>
      <Field.Control required class="lu-input" />
      <Field.Error />
      <Field.Validity>
        {(state) => (
          <p>
            {state.validating ? "Checking…" : state.validity.valid ? `${state.value} is free.` : ""}
          </p>
        )}
      </Field.Validity>
    </Field.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-field` on `Root` and `lu-input` on the control: the parts
stack with a small gap, the label is medium weight, the description muted, the errors red (a
lighter red in dark, to keep 4.5:1), and an invalid control gets a red border.

**With your own CSS**, style the parts through `class` and state:

- the control: `[aria-invalid="true"]` while an error shows, `:user-invalid` (invalid after the
  user interacted), `:invalid`, `:focus-visible`, `:disabled`;
- the field: `lu-field:has([aria-invalid="true"])`, `lu-field:focus-within`, and
  `lu-field[data-validating]` while an async `validate` runs;
- the errors: `output` in the field (`[hidden]` while they do not apply).

```css
.field {
  display: grid;
  gap: 0.25rem;
}
.field [aria-invalid="true"] {
  border-color: #dc2626;
}
.field output {
  color: #b91c1c;
  font-size: 0.875rem;
}
```

`@lumiose/ui/field.css` holds what Field needs to work, in the `lu.core` layer: `lu-field` is a
block, and the errors the script hides stay hidden whatever `display` your CSS gives them.

## Keyboard and focus

The control's own keyboard. Field adds focus on a submit attempt: the first invalid control of the
form, in DOM order, takes focus, and its error is part of its accessible description, so a screen
reader reads it there.

- **On a submit attempt**, every invalid field shows its errors; the browser's bubble does not
  appear for a field with an Error part that shows the problem. A problem none of its Errors
  match (a missing value where the only Error has `match="tooShort"`) still gets the bubble.
- **`validationMode="onBlur"`** shows a field's error when focus leaves it, except a missing value
  in a field the user has not edited yet (Base UI's rule). **`"onChange"`** shows it as the user
  types.
- **Once shown**, an error follows the value: it updates as the problem changes and goes away when
  the value is valid. A server error goes away as soon as the value changes, and shows again
  each time an action fails with it, the same message included.
- **A form reset** hides every error.

## Without JavaScript, and the field's script

The control, its `for` label and its constraints are native: the browser validates on submit and
reports the first problem in its own bubble, and the form submits when everything is valid. Server
errors from a Form render in the HTML, visible and linked with `aria-describedby` and
`aria-invalid`.

Two limits of the server HTML, which the script corrects once it runs (decision-62): the server
writes the control's attributes before it renders the parts after it, so a Description below the
control is linked only by the script, and an invalid field's control points `aria-describedby` at
the message Error's id (`Field.Error` without children or `match`) even when the field only has
Errors with children or a `match`. Give a field that must read well without JavaScript a message
Error, and its Descriptions before the control.

A page that renders a `Field` loads a 1.7 kB (brotli) script once, without the Lumiose runtime;
islands bundle it. On a submit attempt (a submit button, Enter in a field, `requestSubmit()` or
the form's `reportValidity()`; a silent `checkValidity()` changes nothing) it cancels the browser's
`invalid` bubble for fields that have an Error part for the problem and shows it there instead (the
browser's message, or one your `validate` set), with the timing above, and focuses the first
invalid control, with no bubble on a later control outside a field. A form action's errors move
focus to the first field that shows one, when the page renders back (unless an `autofocus` element
has it) and when an island's errors arrive. It also keeps `aria-invalid` and
`aria-describedby` current (a description rendered after the control is linked once the script
runs), and hides server errors once the value changes. When an async `validate` settles, Field.Root
fires `validitychange` (not bubbling) on the control, and the script shows the new verdict. When a
form action's errors arrive in an island, Field.Root fires it on `<lu-field>` with the messages
(`detail.errors`), and the script shows them as the server's, even when they repeat.

**`requestSubmit()` and `reportValidity()`.** The browser fires the same `invalid` events for a
silent `checkValidity()` as for a submit attempt, and only a submit attempt should show errors and
move focus. A submit button's click and Enter are seen as they happen; the two methods are not, so
the script wraps `HTMLFormElement.prototype.requestSubmit` and `reportValidity` once, when it
loads. The wrappers only mark the form as attempting a submit for the duration of the call, and
then call the browser's own method with the same `this`, arguments and return value, throwing what
it throws (decision-62).

## Browser support

- **Constraint validation**, `:user-invalid` (Chrome 119, Firefox 88, Safari 16.5) and the
  `invalid` event: in every supported browser.
- **`<output for>`**: in every browser; Chromium and screen readers include an output's text in
  the control's description. Playwright's own `toHaveAccessibleDescription` leaves it out; the
  @lumiose/ui tests read Chromium's computation instead.

## Related

- [Form](form.md): server errors for the fields, by name.
- [Input](input.md): `Field.Control`.
- [Fieldset](fieldset.md): a group of fields with a legend.
- [Checkbox](checkbox.md), [Switch](switch.md), [Radio Group](radio-group.md),
  [Select](select.md), [Combobox](combobox.md), [Autocomplete](autocomplete.md),
  [Number Field](number-field.md), [Slider](slider.md): controls that take a field's wiring.
- [Data and actions](https://itsjavi.com/lumiose/docs/concepts/data-and-actions/): form actions,
  `fail()` and `actionData()`.
