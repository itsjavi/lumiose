# Select

> A native `<select>` for picking one value from a list: it works with no JavaScript, submits with its form and keeps the platform's keyboard, typeahead and mobile pickers. Where the browser has customizable select (`appearance: base-select`, Chrome 135, Safari 27), `Select.Trigger` and `Select.Value` shape the button, the picker is styleable and options may hold more than text; elsewhere it is the classic select. No script; `bind:value` keeps a signal in sync in islands.

```ts
import { Select } from "@lumiose/ui"; // or "@lumiose/ui/select"
import "@lumiose/ui/select.css"; // makes a select with a Trigger a customizable select
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Select.Root>
  <Select.Trigger>
    <Select.Value />
  </Select.Trigger>
  <Select.Item />
  <Select.Separator />
  <Select.Group>
    <Select.Item />
  </Select.Group>
</Select.Root>
```

| Part        | Renders                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| `Root`      | `<select>`, the control (`role="combobox"`), with the props it is given.                                |
| `Trigger`   | `<button type="button">`, customizable select's button. Optional; it must be the first child of `Root`. |
| `Value`     | `<selectedcontent>`, where the browser copies the selected option's content. Inside the `Trigger`.      |
| `Item`      | `<option value="…">`.                                                                                   |
| `Group`     | `<optgroup label="…">` of options.                                                                      |
| `Separator` | `<hr>` between options or groups.                                                                       |

The picker, the popup of options, is the select's own `::picker(select)`: there is no part for it.
Browsers without customizable select drop the `Trigger` and show their own control and picker, with
the options' text.

## API

### Select.Root

| Prop            | Type                      | Default          |                                                                                   |
| --------------- | ------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `value`         | `string`                  |                  | Selects the option with this value when it changes. Pair it with `onValueChange`. |
| `defaultValue`  | `string`                  | the first option | The option selected at first, when `value` is left out.                           |
| `onValueChange` | `(value: string) => void` |                  | Called after the user selects another option, with its value.                     |
| `bind:value`    | `Signal<string>`          |                  | Stands in for `value` and `onValueChange`.                                        |
| `name`          | `string`                  |                  | The name the value is submitted under.                                            |
| `required`      | `boolean`                 | `false`          | The form needs a value: an option whose value is `""` counts as none.             |
| `disabled`      | `boolean`                 | `false`          | The select cannot be used.                                                        |

Every other `<select>` prop passes through: `id`, `autocomplete`, `form`, `class`, `aria-*`, event
handlers. Name it with a `<label for>` pointing at its `id`, or `aria-label`, or put it in a
[Field](field.md) with a `Field.Label`: it takes the field's id, name and ARIA references.

### Select.Item

| Prop       | Type      | Default |                                                                   |
| ---------- | --------- | ------- | ----------------------------------------------------------------- |
| `value`    | `string`  |         | Required: the value the select takes, and submits, when selected. |
| `disabled` | `boolean` | `false` | The option cannot be selected; the arrow keys skip it.            |

### Select.Group

| Prop    | Type     | Default |                                                    |
| ------- | -------- | ------- | -------------------------------------------------- |
| `label` | `string` |         | Required: the group's name, shown above its items. |

### The other parts

`Trigger`, `Value` and `Separator` take the props of the element they render (`class`, `style`,
`aria-*`, `data-*`) and pass them through.

**Differences from Base UI's Select.** Select is the native control, chosen over the listbox
pattern because it works without JavaScript, carries forms, autofill, validation and the mobile
pickers, and ships no script. So it has no `open`, `onOpenChange` or `modal` (the platform fires no
event when the picker opens; style `:open` instead), no `Label` (use `<label for>`), no `multiple`
(use [Combobox](combobox.md) with `multiple`), no `alignItemWithTrigger` (the picker opens below the
control and flips), no `Portal`, `Positioner`, `Popup`, `List`, `Icon`, `ItemText`,
`ItemIndicator`, `GroupLabel`, `Arrow` or scroll arrows (the picker, `::picker-icon` and
`option::checkmark` are the platform's), and Enter does not open it (Space and the arrows do, as on
any select).

## Example

A select in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Select } from "@lumiose/ui";

export function PlanField() {
  return (
    <form method="post">
      <label for="plan">Plan</label>
      <Select.Root id="plan" name="plan" defaultValue="pro" class="lu-select">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Item value="free">Free</Select.Item>
        <Select.Item value="pro">Pro</Select.Item>
        <Select.Separator />
        <Select.Group label="Teams">
          <Select.Item value="team">Team</Select.Item>
          <Select.Item value="enterprise" disabled>
            Enterprise
          </Select.Item>
        </Select.Group>
      </Select.Root>
      <button class="lu-button">Save</button>
    </form>
  );
}
```

In an island, bound to a signal. `bind:value={theme}` is short for `value={theme()}` plus
`onValueChange={(next) => theme.set(next)}`.

```tsx check
import { Select } from "@lumiose/ui";
import { signal } from "lumiose";

export function ThemePicker() {
  const theme = signal("system");
  return (
    <Select.Root aria-label="Theme" bind:value={theme} class="lu-select">
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Item value="light">Light</Select.Item>
      <Select.Item value="dark">Dark</Select.Item>
      <Select.Item value="system">System</Select.Item>
    </Select.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-select` on `Root`. It makes the select a customizable select
and styles the control, the picker, the options (hover and keyboard focus, disabled), the groups and
the separators; in browsers without customizable select it styles the closed control. Its colours
come from the theme's `--lu-` properties ([UI components](README.md#the-default-theme)).

**With your own CSS**, opt in to customizable select and style the select's parts and states:

- the control: the `select` itself, `:open` while its picker is open, `:focus-visible`,
  `:disabled`, `:invalid` and `:user-invalid`, and `::picker-icon`;
- the picker: `::picker(select)`, placed with anchor positioning (`position-area`,
  `position-try-fallbacks` work on it);
- options: `option`, `option:checked`, `option:hover`, `option:focus-visible`, `option:disabled`,
  and `option::checkmark`;
- `optgroup`, `hr`, and inside the `Trigger`, `selectedcontent`.

A starting point:

```css
.select,
.select::picker(select) {
  appearance: base-select;
}
.select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #85858e;
  border-radius: 0.5rem;
}
.select::picker(select) {
  padding: 0.25rem;
  border: 1px solid #e4e4e7;
  border-radius: 0.5rem;
}
.select option:focus-visible {
  background: #f4f4f5;
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
```

`@lumiose/ui/select.css` holds what Select needs to work, in the `lu.core` layer: a select whose
first child is a `Trigger` gets `appearance: base-select` (and so does its picker), since only a
customizable select renders the trigger, `Value` and options with more than text. A select with no
`Trigger` keeps the browser's look until your CSS or the theme opts in.

## Keyboard and focus

The platform's: the select is one tab stop with `role="combobox"`, and the browser runs the
keyboard. In Chromium's customizable select:

| Key                         | Does                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Space, Arrow Down, Arrow Up | On the control: opens the picker, with focus on the selected option.                                    |
| Alt+Arrow Down, F4          | On the control: opens the picker.                                                                       |
| Arrow Down, Arrow Up        | In the picker: the next or previous option; disabled options are skipped.                               |
| Home, End                   | In the picker: the first or last option.                                                                |
| A character                 | In the picker: typeahead, the next option whose text starts with it.                                    |
| Enter, Space                | In the picker: selects the focused option and closes the picker.                                        |
| Escape                      | Closes the picker without selecting, focus back on the control; closed, it goes on, so a dialog closes. |
| Tab                         | In the picker: closes it, focus back on the control; from there Tab moves on.                           |

A click on a `<label for>` focuses the select without opening it. A click on the control opens the
picker; a click on an option selects it; a click outside closes the picker. Other browsers keep
their own select keyboard and pickers, which differ by platform.

## Without JavaScript

Select needs none: it is a native control, in server HTML and with JavaScript off, on every
browser. It submits under its `name`, is validated (`required`), resets with its form, takes the
browser's autofill and is disabled by a disabled `<fieldset>`. `value`, `onValueChange` and
`bind:value` need the component to run in the browser, in an island; there `value` sets the
control's value when it changes, and its `change` event calls `onValueChange`.

## Browser support

- **Customizable select** (`appearance: base-select`, `::picker(select)`, `<selectedcontent>`, a
  `<button>` and rich content inside `<select>`): Chrome and Edge 135, Safari 27. Firefox has none
  yet: it shows its classic select, styled by the theme when closed, with the options' text.
- In browsers without customizable select, the HTML parser drops the `Trigger` and tags inside
  options from server HTML, so an island's select falls back to rendering on the client there
  ([LUM4006](https://itsjavi.com/lumiose/docs/errors/LUM4006/)); keep options to text if that
  matters to you.
- **`:open`** comes with customizable select; Safari 27's support is unverified here (the
  end-to-end tests run in Chromium).

## Related

- [Combobox](combobox.md): when the list is long enough to filter, for several values, or for
  async options.
- [Menu](menu.md): commands rather than a value.
- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Islands](https://itsjavi.com/lumiose/docs/concepts/islands/): running a component in the
  browser, for `bind:value`.
