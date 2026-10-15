# Fieldset

> A group of related fields with a caption: a native `<fieldset>` and `<legend>`, after Base UI's Fieldset. The browser names the group by its legend and disables every control inside a disabled fieldset, with no JavaScript and no CSS of its own. The legend also names a Checkbox Group or a Radio Group.

```ts
import { Fieldset } from "@lumiose/ui"; // or "@lumiose/ui/fieldset"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Fieldset.Root>
  <Fieldset.Legend />
</Fieldset.Root>
```

| Part     | Renders                                             |
| -------- | --------------------------------------------------- |
| `Root`   | `<fieldset>`, a group (`role="group"`).             |
| `Legend` | `<legend>`, which names the group; the first child. |

## API

### Fieldset.Root

| Prop       | Type      | Default |                                                                               |
| ---------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `disabled` | `boolean` | `false` | Disables every control inside, except those in its legend; none is submitted. |

Every other `<fieldset>` prop (`form`, `name`, `class`, `aria-*`) passes through.

### Fieldset.Legend

The `<legend>`'s props pass through. Put it first in the fieldset, or first in a
[CheckboxGroup](checkbox-group.md) or [RadioGroup](radio-group.md), which render a fieldset too.

**Differences from Base UI's Fieldset.** `Legend` is a native `<legend>` (Base UI renders a
`<div>` labelling the fieldset), so the group is named without ARIA.

## Example

```tsx check
import { Field, Fieldset } from "@lumiose/ui";

export function AddressFields() {
  return (
    <Fieldset.Root class="lu-fieldset">
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Field.Root name="street" class="lu-field">
        <Field.Label>Street</Field.Label>
        <Field.Control autocomplete="street-address" class="lu-input" />
      </Field.Root>
      <Field.Root name="city" class="lu-field">
        <Field.Label>City</Field.Label>
        <Field.Control autocomplete="address-level2" class="lu-input" />
      </Field.Root>
    </Fieldset.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-fieldset` on `Root`: no border or padding, the legend
semi-bold, the fields in a column.

**With your own CSS**, style the `fieldset` and `legend`, and `:disabled` (`fieldset:disabled`
matches a disabled fieldset; its controls match `:disabled`). A fieldset's minimum width defaults
to its content's: set `min-inline-size: 0` to let it shrink.

Fieldset ships no stylesheet: it needs none to work.

## Keyboard and focus

The controls' own. A fieldset is not focusable; a disabled fieldset takes its controls out of the
tab order. Screen readers announce the legend when focus enters the group.

## Without JavaScript

Everything is native: the group, its name, and `disabled`, in server HTML. No script.

## Browser support

`<fieldset>`, `<legend>` and `fieldset[disabled]`: every browser.

## Related

- [Field](field.md): the fields inside.
- [Checkbox Group](checkbox-group.md) and [Radio Group](radio-group.md): groups of choices, named
  by a `Fieldset.Legend`.
- [Form](form.md).
