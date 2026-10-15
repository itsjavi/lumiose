# Checkbox

> A native `<input type="checkbox">`, after Base UI's Checkbox: Space and a label click toggle it, the form submits its value when checked, reset and `required` work, in server HTML and without JavaScript. `indeterminate`, `readOnly`, the parent checkbox of a [Checkbox Group](checkbox-group.md) and `bind:checked` come on top, with a 0.5 kB script shared with Radio Group and Switch.

```ts
import { Checkbox } from "@lumiose/ui"; // or "@lumiose/ui/checkbox"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<label>
  <Checkbox.Root /> Label
</label>
```

| Part   | Renders                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| `Root` | `<input type="checkbox">`; `data-indeterminate` in server HTML while indeterminate, `aria-readonly` if read-only. |

Name it with a wrapping `<label>`, a `<label for>`, a `Field.Label`, or `aria-label`.

## API

### Checkbox.Root

| Prop              | Type                         | Default |                                                                                                      |
| ----------------- | ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `checked`         | `boolean`                    |         | Checks or unchecks it when it changes. Pair it with `onCheckedChange`.                               |
| `defaultChecked`  | `boolean`                    | `false` | Whether it starts checked; a form reset goes back to it.                                             |
| `onCheckedChange` | `(checked: boolean) => void` |         | Called after the user checks or unchecks it.                                                         |
| `bind:checked`    | `Signal<boolean>`            |         | Stands in for `checked` and `onCheckedChange`.                                                       |
| `indeterminate`   | `boolean`                    | `false` | Neither checked nor unchecked (mixed for assistive technology) until the user toggles it.            |
| `value`           | `string`                     | `"on"`  | What it submits when checked, and its identity in a Checkbox Group.                                  |
| `parent`          | `boolean`                    | `false` | The "select all" checkbox of a Checkbox Group: it checks them all and follows them. Never submitted. |
| `readOnly`        | `boolean`                    | `false` | It cannot be toggled, but stays focusable and is submitted.                                          |

Every other native prop passes through: `name`, `required`, `disabled`, `form`, `id`, `class`,
`aria-*`. Inside a Field it takes the field's `id`, `name`, `aria-describedby` and
`aria-invalid`; inside a Checkbox Group, its `checked` state and `name`.

**Differences from Base UI's Checkbox.** The box is the native input, so there is no
`Checkbox.Indicator`: draw the box and its mark with `appearance: none` and `::before` (as the
default theme does). There is no `nativeButton`, `inputRef` or `uncheckedValue`: an unchecked box
submits nothing, as a native one does.

## Example

In an island, bound to a signal:

```tsx check
import { Checkbox } from "@lumiose/ui";
import { signal } from "lumiose";

export function NewsletterOptIn() {
  const subscribed = signal(false);
  return (
    <p>
      <label>
        <Checkbox.Root name="newsletter" bind:checked={subscribed} class="lu-checkbox" /> Send me
        the newsletter
      </label>{" "}
      {subscribed() ? "Thanks!" : ""}
    </p>
  );
}
```

## Styling

**With the default theme**, put `lu-checkbox` on `Root`: an 18px box drawn by `::before` inside a
24px target, a ✓ when checked and a dash when indeterminate (a symbol, not only a colour), the
primary colour for both, a focus ring, a red border with `aria-invalid="true"`.

**With your own CSS**, style the input and its state: `:checked`, `:indeterminate` (and
`[data-indeterminate]` before the script runs), `:disabled`, `:focus-visible`,
`[aria-readonly="true"]`, `[aria-invalid="true"]`.

```css
.checkbox {
  appearance: none;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border: 1px solid #85858e;
  border-radius: 0.25rem;
}
.checkbox:checked {
  background: #2563eb;
}
.checkbox:checked::before {
  content: "✓" / "";
  color: #fff;
}
```

Checkbox ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key   | Does                                                   |
| ----- | ------------------------------------------------------ |
| Space | Toggles it (not when read-only).                       |
| Tab   | Moves to the next control: a checkbox is one tab stop. |

Enter does not toggle it. A click on its label toggles it too.

## Without JavaScript, and the client script

A native checkbox: toggling, submission, `required`, reset and `disabled` (its own or a fieldset's)
work with no script.

A page that renders a Checkbox, Checkbox Group, Radio Group or Switch loads one 0.5 kB (brotli)
script once, without the Lumiose runtime; islands bundle it. It turns server HTML's
`data-indeterminate` into the `indeterminate` property (which has no attribute), makes read-only
inputs ignore clicks, Space and the label, and runs the parent checkbox of a group. Without it, an
indeterminate box shows unchecked (the theme still draws it mixed) and a read-only one toggles.

## Browser support

Native checkboxes, `:indeterminate` and `appearance: none` with `::before`: every supported
browser.

## Related

- [Checkbox Group](checkbox-group.md): several checkboxes with one value and a parent checkbox.
- [Switch](switch.md): on and off for a setting that applies at once.
- [Field](field.md): a label, a description and errors for a checkbox.
