# Meter

> A measurement within a known range (storage used, a password's strength, a rating), after Base UI's Meter: a native `<meter>` (with its value, range and `aria-valuetext`), labelled, with the value as text (a percentage of the range by default, or your `Intl.NumberFormat` options). No script.

```ts
import { Meter } from "@lumiose/ui"; // or "@lumiose/ui/meter"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Meter.Root value={72}>
  <Meter.Label />
  <Meter.Value />
  <Meter.Track />
</Meter.Root>
```

| Part    | Renders                                         |
| ------- | ----------------------------------------------- |
| `Root`  | `<div>` with `--lu-value` (`0%` to `100%`)      |
| `Label` | `<label for>` the track                         |
| `Value` | `<span>` with the formatted value               |
| `Track` | `<meter value min max aria-valuetext>`: the bar |

## API

### Meter.Root

| Prop               | Type                                                | Default             |                                                                                     |
| ------------------ | --------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `value`            | `number`                                            |                     | The measurement, from `min` to `max`. Required.                                     |
| `min`              | `number`                                            | `0`                 | The bottom of the range.                                                            |
| `max`              | `number`                                            | `100`               | The top of the range.                                                               |
| `format`           | `Intl.NumberFormatOptions`                          | a percentage        | How the value is written. With it, the value itself is formatted, not a percentage. |
| `locale`           | `Intl.LocalesArgument`                              | the browser's       | The locale of the formatted value (the server's in server HTML).                    |
| `getAriaValueText` | `(formattedValue: string, value: number) => string` | the formatted value | The text assistive technology reads.                                                |

Every other prop passes through to the `<div>`: `id`, `class`, `style`.

### Meter.Label, Meter.Track and Meter.Value

`Label` takes `<label>` props, its `id` among them; the `Track` keeps its own `id`, which the
`Label` before it points at (see [Ids](README.md#ids)). `Track` takes `<meter>` props, among them the native `low`, `high`
and `optimum`, which tell browsers which band a value is in (`aria-label` when there is no
`Label`). `Value` takes `<span>` props, and its `children` may be a function
`(formattedValue, value) => JSX.Element`.

**Differences from Base UI's Meter.** The `<meter>` element is the track and the indicator: there is
no `Meter.Indicator`. Root has no `role`; the `<meter>` has it (`meter`).

## Example

```tsx check
import { Meter } from "@lumiose/ui";

export function StorageMeter() {
  return (
    <Meter.Root
      value={7.2}
      max={10}
      getAriaValueText={(_, gb) => `${gb} of 10 GB`}
      class="lu-meter"
    >
      <Meter.Label>Storage used</Meter.Label>
      <Meter.Value>{(_, gb) => `${gb} GB of 10`}</Meter.Value>
      <Meter.Track low={6} high={9} optimum={0} />
    </Meter.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-meter` on `Root`: the label and the value on a row above a 10px
bar, its edge in `--lu-input` (3:1, so the whole range shows) and its value in the primary colour
(a lighter blue in dark mode), whatever band it is in.

**With your own CSS**, style the bar with `appearance: none` and its pseudo-elements:
`::-webkit-meter-bar`, `::-webkit-meter-optimum-value`, `::-webkit-meter-suboptimum-value`,
`::-webkit-meter-even-less-good-value`, `::-moz-meter-bar` (and `:-moz-meter-optimum` and the
others). Or draw your own bar from `--lu-value` on `Root`.

Meter ships no stylesheet: it needs none to work.

## Keyboard and focus

A meter is not interactive: it takes no focus and no keys.

## Without JavaScript

Fully: the server renders the `<meter>` with its value, range, label and text.

## Browser support

Native `<meter>`: every browser. Its pseudo-elements differ between engines, hence the two sets
above. `role="meter"` reaches screen readers in recent versions; older ones read a progress bar.

## Related

- [Progress](progress.md): a task's progress, which can be indeterminate.
- [Slider](slider.md): a value the user picks within a range.
