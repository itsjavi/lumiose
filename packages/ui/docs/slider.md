# Slider

> A value picked within a range by dragging or with the keys, or a range with two thumbs, after Base UI's Slider. Each thumb is a native `<input type="range">`, so it drags, takes the arrow keys, Home and End, follows the text direction and submits with its form, in server HTML and without JavaScript. `<lu-slider>` adds Page Up and Page Down, keeps a range's thumbs in order, moves the nearest thumb on a press on the track and keeps the value text current. `bind:value` keeps a signal in sync.

```ts
import { Slider } from "@lumiose/ui"; // or "@lumiose/ui/slider"
import "@lumiose/ui/slider.css"; // or "@lumiose/ui/styles.css" for every component
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Slider.Root>
  <Slider.Label />
  <Slider.Value />
  <Slider.Control>
    <Slider.Track>
      <Slider.Indicator />
    </Slider.Track>
    <Slider.Thumb />
  </Slider.Control>
</Slider.Root>
```

| Part        | Renders                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-slider data-orientation data-thumb-alignment>` with `--lu-slider-start` and `--lu-slider-end`                                |
| `Label`     | `<label for>` the first thumb; thumbs without an `aria-label` are labelled by it                                                  |
| `Value`     | `<output for>` the thumbs, with the formatted values (`20 – 80`)                                                                  |
| `Control`   | `<div>`: the track and the thumbs stacked in one place; presses on it move a thumb. A range's is a `role="group"` the Label names |
| `Track`     | `<div>`: the rail                                                                                                                 |
| `Indicator` | `<div>`: the selected part, from `--lu-slider-start` to `--lu-slider-end`                                                         |
| `Thumb`     | `<input type="range" min max step value name>`, one per value, in order                                                           |

## API

### Slider.Root

| Prop                     | Type                             | Default        |                                                                                                                 |
| ------------------------ | -------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| `value`                  | `number \| number[]`             |                | Moves the thumbs when it changes (an array: one value per thumb). Pair it with `onValueChange`.                 |
| `defaultValue`           | `number \| number[]`             | `min`          | The value at first; a form reset goes back to it.                                                               |
| `onValueChange`          | `(value) => void`                |                | Called with the new value as a thumb moves.                                                                     |
| `onValueCommitted`       | `(value) => void`                |                | Called when a move ends: a release, a key press.                                                                |
| `bind:value`             | `Signal<number \| number[]>`     |                | Stands in for `value` and `onValueChange`.                                                                      |
| `min`                    | `number`                         | `0`            | The smallest value.                                                                                             |
| `max`                    | `number`                         | `100`          | The largest value.                                                                                              |
| `step`                   | `number`                         | `1`            | The step of the arrow keys; values snap to it.                                                                  |
| `largeStep`              | `number`                         | `10`           | The step of Page Up, Page Down and Shift with an arrow key.                                                     |
| `minStepsBetweenValues`  | `number`                         | `0`            | With several thumbs: how many steps apart they stay.                                                            |
| `thumbCollisionBehavior` | `"push"` \| `"swap"` \| `"none"` | `"push"`       | With several thumbs: a thumb moved into another pushes it along, swaps places with it (a drag), or stops at it. |
| `thumbAlignment`         | `"edge"` \| `"center"`           | `"edge"`       | The thumbs stop inside the control at its ends, or with their centre on its ends (overhanging it).              |
| `orientation`            | `"horizontal"` \| `"vertical"`   | `"horizontal"` | Vertical sliders run bottom to top.                                                                             |
| `disabled`               | `boolean`                        | `false`        | Disables every thumb.                                                                                           |
| `name`                   | `string`                         |                | The thumbs submit their values under it, one entry each.                                                        |
| `form`                   | `string`                         |                | The id of a form the thumbs belong to, when they are outside it.                                                |
| `format`                 | `Intl.NumberFormatOptions`       | plain numbers  | How the values are written; with it, each thumb's `aria-valuetext` is its formatted value.                      |
| `locale`                 | `string`                         | the browser's  | The locale of the formatted values (the server's in server HTML).                                               |

The value's type follows `value`, `defaultValue` or `bind:value`: a number for one thumb, a
`number[]` for a range. Every other prop passes through to `<lu-slider>`: `id`, `class`, `style`.

### The other parts

`Label` takes `<label>` props. `Value` takes `<output>` props, and its `children` may be a function
`(formattedValues, values) => JSX.Element` (then it has no `for`, and you render its text). `Control`,
`Track` and `Indicator` take `<div>` props. `Thumb` takes `<input>` props except the range's own
(`aria-label`, `aria-valuetext`, `disabled`, `id`, `class`). Give each thumb of a range an
`aria-label` with the label's text in it ("Minimum price" under "Price"), so speech users can say
what they see (WCAG 2.5.3); the Label names the range's group (`Control`), so screen readers
announce "Price, group" before the thumbs. Inside a Field, the first thumb takes the field's id,
name, description and error.

- **`thumbCollisionBehavior="swap"`.** A thumb dragged past another (with the pointer, or a press
  on the track) trades places with it: the values stay in order, the other thumb takes the
  dragged value and focus, and the drag goes on with it. A native drag keeps its own thumb, so
  that thumb stays put and hands its value on. The keys stop at the other thumb, as with
  `"none"`, and `minStepsBetweenValues` applies to keys only.
- **`thumbAlignment` and `--lu-slider-thumb-size`.** A native thumb stays inside its input. With
  the thumbs' size in `--lu-slider-thumb-size` (the default theme sets it), slider.css runs the
  track between the thumbs' centres at the ends, so the Indicator ends at a thumb's centre
  whatever the value (`"edge"`); with `"center"` the inputs outgrow the control by half a thumb
  at each end, so the thumbs' centres reach its ends and the track spans it. Without the
  variable, the Indicator can end up to half a thumb from its centre.

**Differences from Base UI's Slider.** Thumbs are the range inputs themselves, so there is no hidden
input, no `inputRef` and no `getAriaLabel` (use `aria-label` on each Thumb). `thumbAlignment`
defaults to `"edge"` (Base UI's to `"center"`), and has no `"edge-client-only"`: the server HTML
is already right. `format` is `Intl.NumberFormatOptions` and `locale` a string, both written to
the element for its script.

## Example

A price range, in an island:

```tsx check
import { Slider } from "@lumiose/ui";
import { signal } from "lumiose";

export function PriceRange() {
  const price = signal([20, 80]);
  return (
    <Slider.Root
      name="price"
      bind:value={price}
      minStepsBetweenValues={5}
      format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
      class="lu-slider"
    >
      <Slider.Label>Price</Slider.Label>
      <Slider.Value />
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
        </Slider.Track>
        <Slider.Thumb aria-label="Minimum price" />
        <Slider.Thumb aria-label="Maximum price" />
      </Slider.Control>
    </Slider.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-slider` on `Root`: the label and the value on a row above a 24px
tall control, an 8px track edged in `--lu-input` (3:1), the selected part in the primary colour,
and 24px round thumbs (`--lu-slider-thumb-size`) with a focus ring around the thumb. Vertical
sliders are 10rem tall. A center-aligned control is inset by half a thumb, so its thumbs overhang
it inside the slider's box.

**With your own CSS**, style the parts through `class`, the thumbs' pseudo-elements
(`::-webkit-slider-thumb`, `::-moz-range-thumb`), `[data-orientation="vertical"]`, `:disabled`,
`:focus-visible`, and the Indicator through `--lu-slider-start` and `--lu-slider-end`. Over a Track,
the thumbs' own tracks are transparent (`appearance: none`). Set `--lu-slider-thumb-size` to your
thumbs' size on the Root, so the track lines up with their centres.

`@lumiose/ui/slider.css` (0.4 kB brotli) stacks the track and thumbs, spans the thumbs over the
control and the Indicator over the selected part, lines the track up with the thumbs' centres
(`--lu-slider-thumb-size`, `data-thumb-alignment`), writes vertical thumbs bottom to top and lets
only the thumbs of a range take the pointer.

## Keyboard and focus

| Key                     | Does                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| Tab                     | Moves between the thumbs, then on: one tab stop per thumb.                   |
| Arrow Right / Arrow Up  | One step up (Arrow Left goes up right to left).                              |
| Arrow Left / Arrow Down | One step down (Arrow Right goes down right to left).                         |
| Page Up / Page Down     | `largeStep` up or down.                                                      |
| Shift + an arrow        | `largeStep` in that direction.                                               |
| Home / End              | The minimum or the maximum (a range's thumb stops at, or pushes, the other). |

Every drag has these keys as its alternative (WCAG 2.5.7). A press on a range's track moves the
nearest thumb there and focuses it; a press on a single slider's track moves its thumb.

## Without JavaScript, and the element's script

The thumbs are native range inputs: dragging, the arrows, Home, End, right to left, vertical,
submission, `disabled` and reset work with no script, and the server HTML has the Indicator's
custom properties and the value text. `<lu-slider>`'s script (1.8 kB brotli) adds Page Up and Page
Down, keeps a range's thumbs in order and apart (or swaps them), moves the nearest thumb on a press
on its track,
and keeps the Indicator, `aria-valuetext` and the Value text current (also after a form reset).
Without it, a range's thumbs can cross, and the Value text and the Indicator stay where the server
put them.

## Browser support

Native range inputs: every browser. Vertical sliders use `writing-mode: vertical-lr` on the thumbs
(Chrome 124, Safari 17.4, Firefox 120 and later).

## Related

- [Field](field.md): a label, description and error for a slider.
- [Meter](meter.md): show a value in a range, without picking it.
- [Input](input.md): `type="number"` for an exact value.
