# Toggle Group

> A set of [Toggles](toggle.md) with one value, after Base UI's ToggleGroup: text alignment (one pressed at a time) or text style (several). `<lu-toggle-group role="group">` presses its toggles and gives the group one tab stop that the arrow keys, Home and End move, following the orientation and the direction, on server pages and in islands. `bind:value` keeps a signal in sync.

```ts
import { Toggle, ToggleGroup } from "@lumiose/ui"; // or "@lumiose/ui/toggle-group"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<ToggleGroup aria-label="Alignment">
  <Toggle value="left">Left</Toggle>
  <Toggle value="center">Center</Toggle>
</ToggleGroup>
```

| Part          | Renders                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `ToggleGroup` | `<lu-toggle-group role="group" data-orientation>`; `multiple` if set   |
| `Toggle`      | `<button aria-pressed value>`; the group's tab stop has `tabindex="0"` |

## API

### ToggleGroup

| Prop            | Type                           | Default        |                                                                            |
| --------------- | ------------------------------ | -------------- | -------------------------------------------------------------------------- |
| `value`         | `string[]`                     |                | Presses these toggles when it changes. Pair it with `onValueChange`.       |
| `defaultValue`  | `string[]`                     | `[]`           | The toggles pressed at first.                                              |
| `onValueChange` | `(value: string[]) => void`    |                | Called after the user presses or releases a toggle.                        |
| `bind:value`    | `Signal<string[]>`             |                | Stands in for `value` and `onValueChange`.                                 |
| `multiple`      | `boolean`                      | `false`        | Several toggles can be pressed; otherwise pressing one releases the other. |
| `orientation`   | `"horizontal"` \| `"vertical"` | `"horizontal"` | Which arrow keys move focus.                                               |
| `loopFocus`     | `boolean`                      | `true`         | The arrow keys go from the last toggle to the first, and back.             |
| `disabled`      | `boolean`                      | `false`        | Disables every toggle.                                                     |

Every other prop passes through to `<lu-toggle-group>`: `aria-label`, `aria-labelledby`, `id`,
`class`. Name the group with one of the first two.

Each toggle's `value` is its identity in the group; its `onPressedChange` still fires. A
`pressedchange` event (`detail.pressed`) bubbles from a toggle before it changes, and
`event.preventDefault()` cancels the change.

**Differences from Base UI's ToggleGroup.** No `render`. Focus follows `tabindex` on the toggles
(roving), as Base UI does; disabled toggles are natively `disabled`, so focus skips them.

## Example

```tsx check
import { Toggle, ToggleGroup } from "@lumiose/ui";
import { signal } from "lumiose";

export function TextAlignment() {
  const align = signal<string[]>(["left"]);
  return (
    <p>
      <ToggleGroup aria-label="Text alignment" bind:value={align} class="lu-toggle-group">
        <Toggle value="left" class="lu-toggle">
          Left
        </Toggle>
        <Toggle value="center" class="lu-toggle">
          Center
        </Toggle>
        <Toggle value="right" class="lu-toggle">
          Right
        </Toggle>
      </ToggleGroup>{" "}
      Aligned: {align()[0] ?? "none"}.
    </p>
  );
}
```

## Styling

**With the default theme**, put `lu-toggle-group` on the group and `lu-toggle` on each toggle: the
toggles in a row with a small gap, in a column when `data-orientation="vertical"`.

**With your own CSS**, style the group by `[data-orientation]` and `[multiple]`, and the toggles by
`[aria-pressed="true"]`, `:focus-visible` and `:disabled`.

Toggle Group ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key                      | Does                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Tab                      | Enters the group on the last focused toggle (at first, the first pressed or the first enabled), and leaves it. |
| Arrow Right / Arrow Left | Horizontal: the next or previous toggle (swapped right to left), looping.                                      |
| Arrow Down / Arrow Up    | Vertical: the next or previous toggle, looping.                                                                |
| Home / End               | The first or last enabled toggle.                                                                              |
| Enter / Space            | Presses or releases the focused toggle.                                                                        |

Arrows move focus without pressing, and skip disabled toggles. With `loopFocus={false}` they stop at
the ends.

## Without JavaScript, and the element's script

The server HTML has each toggle's `aria-pressed` and the tab stop. `<lu-toggle-group>`'s script
(0.8 kB brotli) presses the toggles and moves focus, on server pages and in islands; with no script
at all the toggles show their state but do not change. For values a form submits, use a
[Checkbox Group](checkbox-group.md) or a [Radio](radio-group.md) group.

## Browser support

Custom elements and `aria-pressed`: every supported browser.

## Related

- [Toggle](toggle.md): one toggle, on its own or in a group.
- [Radio](radio-group.md): one choice submitted with a form.
- [Tabs](tabs.md): toggles that switch panels.
