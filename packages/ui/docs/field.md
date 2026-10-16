# Field

> A form field: a label, a native control, a description and its errors, wired with `for`, `aria-describedby` and `aria-invalid`, after Base UI's Field. Validation is the browser's constraint validation (`required`, `type`, `pattern`, `minlength`…); a 1.0 kB script shows it in the field's Error parts at the right time, instead of the browser's bubble, and focuses the first invalid field on submit. A Form's server errors render in the HTML, so they work without JavaScript.

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
</Field.Root>
```

| Part          | Renders                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`        | `<lu-field>`, a block around the other parts, with `validation-mode`.                                                                        |
| `Label`       | `<label for="…">`, pointing at the control.                                                                                                  |
| `Control`     | `<input>`: [Input](input.md), with the field's `id`, `name`, `aria-describedby` and `aria-invalid`.                                          |
| `Description` | `<p>` that describes the control.                                                                                                            |
| `Error`       | `<output hidden>`: without children, the field's message (`for` the control); with children, your message. Shown while the field is invalid. |

Instead of `Field.Control`, a field can hold a [Checkbox](checkbox.md), a [Switch](switch.md), a
[Select](select.md), a [Radio Group](radio-group.md), a [Combobox](combobox.md), an
[Autocomplete](autocomplete.md), a [Number Field](number-field.md) or a [Slider](slider.md): they
take the field's wiring the same way (a Combobox and an Autocomplete through their input).

## API

### Field.Root

| Prop             | Type                                           | Default      |                                                                                                                                             |
| ---------------- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | `string`                                       |              | The control's `name` (unless it has its own), and the key of the field's errors in the Form's `errors`.                                     |
| `disabled`       | `boolean`                                      | `false`      | Disables the control.                                                                                                                       |
| `invalid`        | `boolean`                                      | `false`      | Marks the field invalid, as a server error does: its Error shows and the control gets `aria-invalid`, until the value changes.              |
| `validationMode` | `"onSubmit" \| "onBlur" \| "onChange"`         | `"onSubmit"` | When errors show: after a submit attempt, also when the control loses focus, or as soon as it is edited. Once shown, they follow the value. |
| `validate`       | `(value: string \| boolean) => string \| null` |              | Your own check, run on every edit in an island: return a message when the value is invalid. It becomes the control's custom validity.       |

`Root` passes `class`, `style` and other element props to `<lu-field>`. A Form's `validationMode`
applies to the fields that set none.

### Field.Error

| Prop       | Type                          | Default |                                                                                                        |
| ---------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `match`    | `keyof ValidityState \| true` |         | Shows only for that problem (`"valueMissing"`, `"typeMismatch"`, `"tooShort"`, …), or always (`true`). |
| `children` | `JSX.Element`                 |         | Your message. Without children, the Error shows the server's message or the browser's.                 |

### Field.Control

[Input](input.md)'s props: every native `<input>` prop, plus `value`, `defaultValue`,
`onValueChange` and `bind:value`.

### The other parts

`Label` and `Description` take the props of the element they render (`class`, `style`, `aria-*`)
and pass them through; their `id` and `for` stay the field's.

**Differences from Base UI's Field.** The control is native and so is validation: there is no
`Field.Validity`, no async `validate` or `validationDebounceTime`, and no `dirty`, `touched`,
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

## Styling

**With the default theme**, put `lu-field` on `Root` and `lu-input` on the control: the parts
stack with a small gap, the label is medium weight, the description muted, the errors red (a
lighter red in dark, to keep 4.5:1), and an invalid control gets a red border.

**With your own CSS**, style the parts through `class` and state:

- the control: `[aria-invalid="true"]` while an error shows, `:user-invalid` (invalid after the
  user interacted), `:invalid`, `:focus-visible`, `:disabled`;
- the field: `lu-field:has([aria-invalid="true"])`, `lu-field:focus-within`;
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
  appear for a field with an Error part.
- **`validationMode="onBlur"`** shows a field's error when focus leaves it, except a missing value
  in a field the user has not edited yet (Base UI's rule). **`"onChange"`** shows it as the user
  types.
- **Once shown**, an error follows the value: it updates as the problem changes and goes away when
  the value is valid. A server error goes away as soon as the value changes.
- **A form reset** hides every error.

## Without JavaScript, and the field's script

The control, its `for` label and its constraints are native: the browser validates on submit and
reports the first problem in its own bubble, and the form submits when everything is valid. Server
errors from a Form render in the HTML, visible and linked with `aria-describedby` and
`aria-invalid`.

A page that renders a `Field` loads a 1.0 kB (brotli) script once, without the Lumiose runtime;
islands bundle it. It cancels the browser's `invalid` bubble for fields that have an Error part and
shows the problem there instead (the browser's message, or one your `validate` set), with the
timing above, focuses the first invalid control on a submit attempt, keeps `aria-invalid` and
`aria-describedby` current (a description rendered after the control is linked once the script
runs), and hides server errors once the value changes.

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
