# Checkbox Group

> A group of checkboxes with one value, the list of the checked ones, after Base UI's CheckboxGroup: a native `<fieldset>` whose checkboxes share a name, so the form submits each checked value and a disabled group disables them all, without JavaScript. A parent checkbox checks them all and shows checked, mixed or unchecked as they are; `bind:value` keeps a signal in sync.

```ts
import { CheckboxGroup, Checkbox, Fieldset } from "@lumiose/ui"; // or "@lumiose/ui/checkbox-group"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<CheckboxGroup>
  <Fieldset.Legend />
  <Checkbox.Root parent />
  <Checkbox.Root />
</CheckboxGroup>
```

| Part            | Renders                                                                             |
| --------------- | ----------------------------------------------------------------------------------- |
| `CheckboxGroup` | `<fieldset>` around the checkboxes; a `Fieldset.Legend` first inside names it.      |
| `Checkbox.Root` | A [Checkbox](checkbox.md) of the group, checked when its `value` is in the group's. |

## API

### CheckboxGroup

| Prop            | Type                        | Default |                                                                                        |
| --------------- | --------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `value`         | `string[]`                  |         | Checks the checkboxes with these values when it changes. Pair it with `onValueChange`. |
| `defaultValue`  | `string[]`                  | `[]`    | The values checked at first.                                                           |
| `onValueChange` | `(value: string[]) => void` |         | Called with the checked values after the user checks or unchecks one.                  |
| `bind:value`    | `Signal<string[]>`          |         | Stands in for `value` and `onValueChange`.                                             |
| `allValues`     | `string[]`                  |         | Every checkbox's value: the parent checkbox's state in server HTML.                    |
| `name`          | `string`                    |         | The name the checkboxes submit under, unless they have their own.                      |
| `disabled`      | `boolean`                   | `false` | Disables every checkbox (a disabled fieldset).                                         |

Every other `<fieldset>` prop passes through.

**Differences from Base UI's CheckboxGroup.** It renders a `<fieldset>`, so a legend names it and
`disabled` is native. `name` is added: Base UI gives each checkbox its own. A parent checkbox
needs only `parent` here, not a controlled group, since the script runs it from the DOM. There is
no `required` (one box checked at least), as in Base UI: HTML has no such constraint for a group,
so it would work only with a script and an unlocalized message of ours. Check it in the form
action instead and return the message with `fail()`: it renders with the page, without JavaScript
too.

## Example

Toppings in a server-rendered form, with a "select all" box:

```tsx check
import { Checkbox, CheckboxGroup, Fieldset } from "@lumiose/ui";

const TOPPINGS = ["Cheese", "Olives", "Peppers"];

export function ToppingsGroup() {
  return (
    <CheckboxGroup
      name="toppings"
      defaultValue={["Cheese"]}
      allValues={TOPPINGS}
      class="lu-fieldset"
    >
      <Fieldset.Legend>Toppings</Fieldset.Legend>
      <label>
        <Checkbox.Root parent class="lu-checkbox" /> All toppings
      </label>
      {TOPPINGS.map((topping) => (
        <label>
          <Checkbox.Root value={topping} class="lu-checkbox" /> {topping}
        </label>
      ))}
    </CheckboxGroup>
  );
}
```

## Styling

**With the default theme**, put `lu-fieldset` on the group and `lu-checkbox` on each checkbox
([Checkbox](checkbox.md#styling)). Style a parent checkbox with `[data-parent]` if it should look
different.

CheckboxGroup ships no stylesheet: it needs none to work.

## Keyboard and focus

Each checkbox is its own tab stop; Space toggles the focused one. Toggling the parent checks or
unchecks every enabled checkbox of the group; toggling one updates the parent (checked, mixed or
unchecked).

## Without JavaScript, and the client script

The checkboxes are native: they toggle, submit under the group's name and reset with no script.
The parent checkbox shows its server state and is never submitted, but checks nothing until the
shared checkbox script (0.6 kB brotli, [Checkbox](checkbox.md#without-javascript-and-the-client-script))
runs.

## Browser support

Every supported browser.

## Related

- [Checkbox](checkbox.md): the checkboxes, `indeterminate` and `readOnly`.
- [Fieldset](fieldset.md): the legend.
- [Radio Group](radio-group.md): one value out of several.
