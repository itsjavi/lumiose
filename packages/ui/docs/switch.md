# Switch

> On or off, for a setting: a native `<input type="checkbox" role="switch">`, after Base UI's Switch. Space and a label click toggle it, the form submits its value when on, `required` and reset work, in server HTML and without JavaScript, and assistive technology announces a switch. `bind:checked` keeps a signal in sync.

```ts
import { Switch } from "@lumiose/ui"; // or "@lumiose/ui/switch"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<label>
  <Switch.Root /> Label
</label>
```

| Part   | Renders                                                                |
| ------ | ---------------------------------------------------------------------- |
| `Root` | `<input type="checkbox" role="switch">`; `aria-readonly` if read-only. |

## API

### Switch.Root

| Prop              | Type                         | Default |                                                                                     |
| ----------------- | ---------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `checked`         | `boolean`                    |         | Turns it on or off when it changes. Pair it with `onCheckedChange`.                 |
| `defaultChecked`  | `boolean`                    | `false` | Whether it starts on; a form reset goes back to it.                                 |
| `onCheckedChange` | `(checked: boolean) => void` |         | Called after the user turns it on or off.                                           |
| `bind:checked`    | `Signal<boolean>`            |         | Stands in for `checked` and `onCheckedChange`.                                      |
| `value`           | `string`                     | `"on"`  | What it submits when on.                                                            |
| `readOnly`        | `boolean`                    | `false` | It cannot be toggled, but stays focusable and is submitted.                         |
| `uncheckedValue`  | `string`                     |         | What it submits when off (by the script); by default an off switch submits nothing. |

Every other native prop passes through: `name`, `required`, `disabled`, `form`, `id`, `class`,
`aria-*`. Inside a Field it takes the field's wiring.

**Differences from Base UI's Switch.** The switch is the native input, so there is no
`Switch.Thumb`: draw the track and thumb with `appearance: none` and `::before`. No `nativeButton` or
`inputRef`; `uncheckedValue` needs the client script (without it an off switch submits nothing). `<input switch>` exists only in
Safari, so `role="switch"` stays on a checkbox everywhere.

## Example

In an island, bound to a signal:

```tsx check
import { Switch } from "@lumiose/ui";
import { signal } from "lumiose";

export function AirplaneMode() {
  const on = signal(false);
  return (
    <p>
      <label>
        <Switch.Root name="airplane" bind:checked={on} class="lu-switch" /> Airplane mode
      </label>{" "}
      {on() ? "Radios off." : ""}
    </p>
  );
}
```

## Styling

**With the default theme**, put `lu-switch` on `Root`: a 40 by 24px track (`--lu-input` when off,
the primary colour when on) and a white thumb on the side that tells on from off, a focus ring.

**With your own CSS**, style the input and its state: `:checked`, `:disabled`, `:focus-visible`,
`[aria-readonly="true"]`, `[aria-invalid="true"]`.

Switch ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key   | Does                                     |
| ----- | ---------------------------------------- |
| Space | Turns it on or off (not when read-only). |
| Tab   | Moves on: one tab stop.                  |

Enter does not toggle it. A click on its label does.

## Without JavaScript, and the client script

A native checkbox with the switch role: toggling, submission, `required`, reset and `disabled`
work with no script. The shared checkbox script (1.0 kB brotli,
[Checkbox](checkbox.md#without-javascript-and-the-client-script)) adds read-only and
`uncheckedValue`.

## Browser support

`role="switch"` on a checkbox: every supported browser and screen reader.

## Related

- [Checkbox](checkbox.md): a choice to confirm, submitted with a form.
- [Field](field.md): a description and errors for a switch.
