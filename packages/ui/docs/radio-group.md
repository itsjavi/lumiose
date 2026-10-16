# Radio

> A group of radios with one value, after Base UI's RadioGroup and Radio: native radios in a `<fieldset role="radiogroup">`. The browser gives the group one tab stop, arrow keys that move and select (skipping disabled radios), `required`, submission and reset, in server HTML and without JavaScript; a legend names the group. `bind:value` keeps a signal in sync.

```ts
import { Radio, RadioGroup, Fieldset } from "@lumiose/ui"; // or "@lumiose/ui/radio-group"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<RadioGroup>
  <Fieldset.Legend />
  <Radio.Root />
</RadioGroup>
```

| Part         | Renders                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `RadioGroup` | `<fieldset role="radiogroup">`; a `Fieldset.Legend` first inside names it.               |
| `Radio.Root` | `<input type="radio">` with the group's `name`, checked when its `value` is the group's. |

Put each radio in a `<label>` (or name it with `aria-label`).

## API

### RadioGroup

| Prop            | Type                      | Default         |                                                                                 |
| --------------- | ------------------------- | --------------- | ------------------------------------------------------------------------------- |
| `value`         | `string`                  |                 | Checks the radio with this value when it changes. Pair it with `onValueChange`. |
| `defaultValue`  | `string`                  |                 | The radio checked at first; none when left out.                                 |
| `onValueChange` | `(value: string) => void` |                 | Called with the value of the radio the user checks.                             |
| `bind:value`    | `Signal<string>`          |                 | Stands in for `value` and `onValueChange`.                                      |
| `name`          | `string`                  | a generated one | The name the radios share and submit under (a Field's `name` inside a Field).   |
| `required`      | `boolean`                 | `false`         | A radio must be checked to submit the form (`aria-required` on the group).      |
| `readOnly`      | `boolean`                 | `false`         | The radios cannot be checked, but stay focusable and are submitted.             |
| `disabled`      | `boolean`                 | `false`         | Disables every radio (a disabled fieldset).                                     |

Every other `<fieldset>` prop passes through. Inside a Field, the group takes the field's
`aria-describedby` and `aria-invalid`, and its radios the field's name.

### Radio.Root

| Prop       | Type      | Default |                                                         |
| ---------- | --------- | ------- | ------------------------------------------------------- |
| `value`    | `string`  |         | Required: the value the group takes when it is checked. |
| `disabled` | `boolean` | `false` | It cannot be checked; the arrow keys skip it.           |

Every other native prop passes through (`id`, `class`, `aria-*`).

**Differences from Base UI's RadioGroup and Radio.** The radios are native inputs in a fieldset, so
there is no `Radio.Indicator` (style `:checked` with `appearance: none`) and no `nativeButton` or
`inputRef`.

## Example

In an island, bound to a signal:

```tsx check
import { Fieldset, Radio, RadioGroup } from "@lumiose/ui";
import { signal } from "lumiose";

export function ShippingChoice() {
  const speed = signal("standard");
  return (
    <div>
      <RadioGroup name="shipping" bind:value={speed} class="lu-fieldset">
        <Fieldset.Legend>Shipping</Fieldset.Legend>
        <label>
          <Radio.Root value="standard" class="lu-radio" /> Standard
        </label>
        <label>
          <Radio.Root value="express" class="lu-radio" /> Express
        </label>
        <label>
          <Radio.Root value="drone" disabled class="lu-radio" /> Drone (soon)
        </label>
      </RadioGroup>
      <p>Arrives {speed() === "express" ? "tomorrow" : "in three days"}.</p>
    </div>
  );
}
```

## Styling

**With the default theme**, put `lu-fieldset` on the group and `lu-radio` on each radio: an 18px
circle in a 24px target, a thick primary ring when checked (a shape, not only a colour), a focus
ring.

**With your own CSS**, style the inputs and their state: `:checked`, `:disabled`,
`:focus-visible`; the group: `[role="radiogroup"]`, `[aria-invalid="true"]`.

Radio Group ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key                     | Does                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| Tab                     | Into the group, on the checked radio (or the first, from either side); out of it. |
| Arrow Down, Arrow Right | Checks the next enabled radio, around at the end.                                 |
| Arrow Up, Arrow Left    | Checks the previous enabled radio, around at the start.                           |
| Space                   | Checks the focused radio.                                                         |

Enter does not check a radio. Read-only radios move focus but do not change. Right to left, Arrow
Left checks the next radio and Arrow Right the previous one.

## Without JavaScript, and the client script

Native radios: the roving tab stop, the arrow keys, `required`, submission and reset work with no
script. The shared checkbox script (0.8 kB brotli,
[Checkbox](checkbox.md#without-javascript-and-the-client-script)) adds read-only, and runs the
arrow keys itself so that every browser follows the table above: without it, WebKit's native
radios stop at the ends and keep Left and Right as they are right to left.

## Browser support

Native radios and `role="radiogroup"` on a fieldset: every supported browser.

## Related

- [Checkbox Group](checkbox-group.md): several values.
- [Select](select.md): one value from a longer list.
- [Field](field.md): a description and errors for the group.
- [Fieldset](fieldset.md): the legend.
