# Toggle

> A two-state button (bold, mute, pin), after Base UI's Toggle: a native `<button type="button" aria-pressed>`. Its label stays the same; `aria-pressed` tells pressed from not. On its own the component presses it, in an island, and `bind:pressed` keeps a signal in sync; inside a [Toggle Group](toggle-group.md) the group presses it, on server pages too.

```ts
import { Toggle } from "@lumiose/ui"; // or "@lumiose/ui/toggle"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Toggle aria-label="Bold">B</Toggle>
```

| Part     | Renders                                                     |
| -------- | ----------------------------------------------------------- |
| `Toggle` | `<button type="button" aria-pressed="true">` (or `"false"`) |

## API

### Toggle

| Prop              | Type                         | Default |                                                                         |
| ----------------- | ---------------------------- | ------- | ----------------------------------------------------------------------- |
| `pressed`         | `boolean`                    |         | Presses or releases it when it changes. Pair it with `onPressedChange`. |
| `defaultPressed`  | `boolean`                    | `false` | Whether it starts pressed.                                              |
| `onPressedChange` | `(pressed: boolean) => void` |         | Called after the user presses or releases it.                           |
| `bind:pressed`    | `Signal<boolean>`            |         | Stands in for `pressed` and `onPressedChange`.                          |
| `value`           | `string`                     |         | Its identity in a Toggle Group's `value`.                               |

Every other native button prop passes through: `disabled`, `id`, `class`, `aria-label`, `aria-*`,
`onClick` (`type` is always `"button"`).

**Differences from Base UI's Toggle.** No `nativeButton` or `render`. `onPressedChange` gets the new
state only; in a group, a `pressedchange` listener can cancel the press with
`event.preventDefault()`.

## Example

```tsx check
import { Toggle } from "@lumiose/ui";
import { signal } from "lumiose";

export function PinToggle() {
  const pinned = signal(false);
  return (
    <p>
      <Toggle bind:pressed={pinned} class="lu-toggle">
        Pin
      </Toggle>{" "}
      {pinned() ? "Pinned to the top." : "Not pinned."}
    </p>
  );
}
```

Give an icon-only toggle an `aria-label` that names the action ("Bold"), not its state.

## Styling

**With the default theme**, put `lu-toggle` on it: a bordered 36px button that, pressed, takes a
filled surface and a bar along its bottom edge, so the state shows by shape and not by colour alone.

**With your own CSS**, style the button and its state: `[aria-pressed="true"]`, `:hover`,
`:focus-visible`, `:disabled`.

Toggle ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key           | Does                         |
| ------------- | ---------------------------- |
| Enter / Space | Presses or releases it.      |
| Tab           | Moves on: one tab stop each. |

In a Toggle Group, the group's arrow keys move between the toggles instead.

## Without JavaScript

A native button with its state in `aria-pressed` from the server. On its own, a Toggle is pressed
by the component, so it needs an island (its state is for your code anyway); in a Toggle Group the
group's script presses it on server pages too. For a value a form submits, use a
[Checkbox](checkbox.md) or a [Switch](switch.md).

## Browser support

`aria-pressed` on a native button: every browser and screen reader.

## Related

- [Toggle Group](toggle-group.md): toggles that share one value, one or several pressed.
- [Switch](switch.md): an on/off setting submitted with a form.
- [Button](button.md): a plain button.
