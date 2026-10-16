# Progress

> A task's progress, after Base UI's Progress: a native `<progress>` (the progress bar for assistive technology, with its value and `aria-valuetext`), labelled, with the value as text (a percentage by default, or your `Intl.NumberFormat` options). With no value it is indeterminate. No script.

```ts
import { Progress } from "@lumiose/ui"; // or "@lumiose/ui/progress"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Progress.Root value={30}>
  <Progress.Label />
  <Progress.Value />
  <Progress.Track />
</Progress.Root>
```

| Part    | Renders                                                                        |
| ------- | ------------------------------------------------------------------------------ |
| `Root`  | `<div>` with `--lu-value` (`0%` to `100%`; unset while indeterminate)          |
| `Label` | `<label for>` the track                                                        |
| `Value` | `<span>` with the formatted value (empty while indeterminate)                  |
| `Track` | `<progress value max aria-valuetext>`: the bar; no `value` while indeterminate |

## API

### Progress.Root

| Prop               | Type                                                | Default             |                                                                                     |
| ------------------ | --------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `value`            | `number \| null`                                    |                     | The progress, from `min` to `max`; `null` while unknown (indeterminate). Required.  |
| `min`              | `number`                                            | `0`                 | The start.                                                                          |
| `max`              | `number`                                            | `100`               | The end: done.                                                                      |
| `format`           | `Intl.NumberFormatOptions`                          | a percentage        | How the value is written. With it, the value itself is formatted, not a percentage. |
| `locale`           | `Intl.LocalesArgument`                              | the browser's       | The locale of the formatted value (the server's in server HTML).                    |
| `getAriaValueText` | `(formattedValue: string, value: number) => string` | the formatted value | The text assistive technology reads.                                                |

Every other prop passes through to the `<div>`: `id`, `class`, `style`.

### Progress.Label, Progress.Track and Progress.Value

`Label` takes `<label>` props, its `id` among them; the `Track` keeps its own `id`, which the
`Label` before it points at (see [Ids](README.md#ids)). `Track` takes `<progress>` props (`aria-label` when there is no
`Label`). `Value` takes `<span>` props, and its `children` may be a function
`(formattedValue, value) => JSX.Element` that writes the value your way.

**Differences from Base UI's Progress.** The `<progress>` element is the track and the indicator:
there is no `Progress.Indicator` (style the element's value pseudo-elements, or use `--lu-value`).
Root has no `role`; the `<progress>` has it.

## Example

An upload, in an island:

```tsx check
import { Progress } from "@lumiose/ui";
import { signal } from "lumiose";

export function UploadProgress() {
  const done = signal<number | null>(null);
  return (
    <p>
      <button
        type="button"
        class="lu-button"
        onClick={() => done.set(Math.min(100, (done() ?? 0) + 20))}
      >
        Upload a part
      </button>
      <Progress.Root value={done()} class="lu-progress">
        <Progress.Label>Uploading</Progress.Label>
        <Progress.Value />
        <Progress.Track />
      </Progress.Root>
    </p>
  );
}
```

## Styling

**With the default theme**, put `lu-progress` on `Root`: the label and the value on a row above a
10px bar, its edge in `--lu-input` (3:1 against the page, so the whole range shows) and its value in
the primary colour (a lighter blue in dark mode). Indeterminate, a segment slides along it; it
stands still where motion is reduced.

**With your own CSS**, style the bar with `appearance: none` and its pseudo-elements:
`::-webkit-progress-bar`, `::-webkit-progress-value`, `::-moz-progress-bar`, and
`progress:indeterminate`. Or draw your own bar from `--lu-value` on `Root`.

Progress ships no stylesheet: it needs none to work.

## Keyboard and focus

A progress bar is not interactive: it takes no focus and no keys.

## Without JavaScript

Fully: the server renders the `<progress>` with its value, the label and the text. It changes when
the component renders again (in an island, from a signal).

Right to left, the native bar fills from the right, and the default theme's indeterminate
segment slides leftward.

## Browser support

Native `<progress>`: every browser. Its pseudo-elements differ between engines, hence the two sets
above.

## Related

- [Meter](meter.md): a measurement within a range, not a task's progress.
- [Toast](toast.md): tell the user when the task is done.
