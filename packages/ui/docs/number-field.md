# Number Field

> A number input with buttons to step it, after Base UI's NumberField and the APG spinbutton. Without `format` it is a native `<input type="number">`, which steps, validates and submits without JavaScript; with `format` (`Intl.NumberFormat` options: a currency, a percentage, grouping) it shows the formatted number, reads what is typed back in the same locale, and a hidden input submits the number. `<lu-number-field>`'s 2.3 kB script adds Page Up and Page Down, Home and End, press-and-hold buttons, a scrub area, the wheel when asked, and commit-time clamping. `bind:value` keeps a signal in sync.

```ts
import { NumberField } from "@lumiose/ui"; // or "@lumiose/ui/number-field"
import "@lumiose/ui/number-field.css"; // or "@lumiose/ui/styles.css" for every component
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<NumberField.Root>
  <NumberField.ScrubArea />
  <NumberField.Group>
    <NumberField.Decrement />
    <NumberField.Input />
    <NumberField.Increment />
  </NumberField.Group>
</NumberField.Root>
```

| Part        | Renders                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-number-field>` with the range and format as attributes, and an `<input type="hidden">` that submits the number with `format` |
| `ScrubArea` | `<span data-scrub>`: dragging across it steps the number (usually around the label)                                               |
| `Group`     | `<div>` around the input and the buttons                                                                                          |
| `Input`     | `<input type="number" inputmode="decimal" min max step>`, or with `format` `<input type="text" role="spinbutton" aria-value…>`    |
| `Increment` | `<button type="button" tabindex="-1" aria-label="Increase" aria-controls="…">`, disabled at `max`                                 |
| `Decrement` | `<button type="button" tabindex="-1" aria-label="Decrease" aria-controls="…">`, disabled at `min`                                 |

Name the field with a [Field](field.md) (`Field.Label`), a `<label for>` the Root's `id`, or an
`aria-label` on the `Input`.

## API

### NumberField.Root

| Prop                               | Type                              | Default       |                                                                                                    |
| ---------------------------------- | --------------------------------- | ------------- | -------------------------------------------------------------------------------------------------- |
| `value`                            | `number \| null`                  |               | Shows this number (`null`: empty) when it changes. Pair it with `onValueChange`.                   |
| `defaultValue`                     | `number \| null`                  | `null`        | The number at first; a form reset goes back to it.                                                 |
| `onValueChange`                    | `(value: number \| null) => void` |               | Called as the number changes: typing, a key, a button, the wheel, a drag.                          |
| `onValueCommitted`                 | `(value: number \| null) => void` |               | Called when a change is done: the input left, a key pressed, a button or a drag released.          |
| `bind:value`                       | `Signal<number \| null>`          |               | Stands in for `value` and `onValueChange`.                                                         |
| `min`, `max`                       | `number`                          |               | The range. A typed number outside it becomes its end when committed.                               |
| `step`                             | `number`                          | `1`           | The step of the arrow keys, the buttons, the wheel and a drag.                                     |
| `largeStep`                        | `number`                          | `10`          | The step of Page Up, Page Down, and Shift with an arrow key or a button.                           |
| `smallStep`                        | `number`                          | `0.1`         | The step of Alt with an arrow key or a button.                                                     |
| `snapOnStep`                       | `boolean`                         | `false`       | A step lands on the next multiple of its size (from `min`, or 0): 1.3 steps up to 2, not 2.3.      |
| `format`                           | `Intl.NumberFormatOptions`        |               | How the number is shown; with it, the input is a text field and a hidden input submits the number. |
| `locale`                           | `string`                          | the browser's | The locale of the formatted number (the server's in server HTML).                                  |
| `allowWheelScrub`                  | `boolean`                         | `false`       | The wheel steps the number while the input has focus and the pointer is over it.                   |
| `allowOutOfRange`                  | `boolean`                         | `false`       | Typed numbers outside the range stay as typed, for the browser's validation to report.             |
| `name`, `form`                     | `string`                          |               | The name the number is submitted under, and the id of its form when it is outside it.              |
| `id`                               | `string`                          | generated     | The input's id, for a `<label for>`.                                                               |
| `required`, `disabled`, `readOnly` | `boolean`                         | `false`       | As on a native input; read-only and disabled fields' buttons are disabled.                         |

### NumberField.ScrubArea

| Prop               | Type                         | Default        |                                                              |
| ------------------ | ---------------------------- | -------------- | ------------------------------------------------------------ |
| `direction`        | `"horizontal" \| "vertical"` | `"horizontal"` | The drag that changes the number: right goes up, or up does. |
| `pixelSensitivity` | `number`                     | `2`            | How many pixels of drag make one step.                       |

### The other parts

`Group` takes `<div>` props. `Input` takes `<input>` props except the range's own (`type`, `value`,
`min`, `max`, `step`, `name`, `required`, `readonly`, `id`: the Root's). `Increment` and
`Decrement` take `<button>` props; give them an `aria-label` in the page's language. Inside a
[Field](field.md), the input takes the field's id, name, description and error.

**Native or formatted.** A native number input cannot show grouping, a currency or a percentage,
and reads a typed number in the browser's own way, so a formatted field is a text field with the
spinbutton role, and the number it submits sits in a hidden input. The native input is the default
because it needs no JavaScript: typing, the arrow keys, `min`, `max` and `step` validation and the
form value are the browser's.

With `snapOnStep`, each kind of step snaps to its own size: Shift steps 37 up to 40, Alt steps
1.37 up to 1.4. A native field (no `format`) still validates the value against `step`.

**Differences from Base UI's NumberField.** No `ScrubAreaCursor`: Base UI draws a cursor because
its scrub area locks the pointer (which hides the real one); this scrub area keeps the real cursor
(a resize cursor), so a drag stops at the screen's edge. No `inputRef`, no `render`. `locale` is a
string, written to the element for its script.

## Example

```tsx check
import { NumberField } from "@lumiose/ui";
import { signal } from "lumiose";

export function PriceField() {
  const price = signal<number | null>(19.9);
  return (
    <NumberField.Root
      id="price"
      name="price"
      bind:value={price}
      min={0}
      step={0.5}
      format={{ style: "currency", currency: "EUR" }}
      class="lu-number-field"
    >
      <NumberField.ScrubArea>
        <label for="price">Price</label>
      </NumberField.ScrubArea>
      <NumberField.Group>
        <NumberField.Decrement aria-label="Lower the price">−</NumberField.Decrement>
        <NumberField.Input />
        <NumberField.Increment aria-label="Raise the price">+</NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-number-field` on `Root`: the label above one bordered group,
the input centred between two 36px buttons that dim at the ends of the range, and a focus ring
around the whole group.

**With your own CSS**, style the parts through `class`, the input's `:focus-visible`, the buttons'
`:disabled` and `[data-action="increment"]` / `[data-action="decrement"]`, the scrub area's
`[data-scrub]`, and `lu-number-field[data-scrubbing]` while a drag is on.

`@lumiose/ui/number-field.css` (0.2 kB brotli) hides the native spinners once the script runs
(`:defined`) and hides the buttons until then, keeps held buttons from selecting text, and gives a
scrub area its resize cursor and `touch-action: none`.

## Keyboard and focus

| Key                     | Does                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| Arrow Up / Arrow Down   | One step up or down.                                                      |
| Shift + Arrow Up / Down | `largeStep` up or down.                                                   |
| Alt + Arrow Up / Down   | `smallStep` up or down.                                                   |
| Page Up / Page Down     | `largeStep` up or down.                                                   |
| Home / End              | `min` or `max`, when set.                                                 |
| Enter                   | Commits the typed number (clamped, formatted); a form submits.            |
| Tab                     | Moves on: one tab stop, the input (the buttons are not in the tab order). |

Right to left, dragging the scrub area toward the left steps up, as a slider runs. A press on a
button steps once (by `largeStep` with Shift, `smallStep` with Alt) and keeps focus where it is; holding it steps again every 60 ms
after 400 ms. A click from a keyboard or a screen reader on a button steps once. Every drag (the
scrub area) has the arrow keys as its alternative (WCAG 2.5.7). The wheel steps the number only
with `allowWheelScrub`, while the input has focus and the pointer is over it (Chromium's own
stepping of a focused number input is turned off otherwise).

## Without JavaScript, and the element's script

Without `format`, the native number input works and submits with no script; the buttons, which
need it, stay hidden and the native spinners show. With `format`, the text input submits its text
as typed until the script moves the name to the hidden input, so a form that must work without
JavaScript should leave `format` out.

`<lu-number-field>`'s script (2.3 kB brotli) adds the large step, Home and End, the buttons, the
scrub area and the wheel, clamps and formats on commit, keeps the hidden input, `aria-valuenow`
and `aria-valuetext` current, and follows a form reset.

## Browser support

Native number inputs and `Intl.NumberFormat` (with `formatToParts`): every supported browser.
Scrubbing uses pointer capture, without pointer lock.

## Related

- [Field](field.md): a label, a description and errors for a number field.
- [Slider](slider.md): a number picked by dragging along a range.
- [Input](input.md): any other text.
