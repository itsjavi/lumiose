# Tooltip

> A short tip next to its trigger, on hover or keyboard focus: a native `popover="hint"` with `role="tooltip"`, placed with CSS anchor positioning. The trigger is described by the tip in server HTML, so screen readers announce it without hovering; a 2.0 kB script opens and closes it as Base UI's tooltip does. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands.

```ts
import { Tooltip } from "@lumiose/ui"; // or "@lumiose/ui/tooltip"
import "@lumiose/ui/tooltip.css"; // places the tip next to its trigger
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Tooltip.Root>
  <Tooltip.Trigger />
  <Tooltip.Popup />
</Tooltip.Root>
```

| Part      | Renders                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `Root`    | No element. Holds the ids the parts share.                                                                  |
| `Trigger` | `<button type="button" aria-describedby="…">`, with an `anchor-name` in its `style`.                        |
| `Popup`   | `<span popover="hint" role="tooltip" data-side="…" data-align="…">`: a `<span>`, so it fits in a paragraph. |

**Accessibility model.** The tooltip follows the
[WAI-ARIA tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/): the tip is the
trigger's description, always, not only while it shows. It is not its name: give an icon-only
trigger an `aria-label` (Base UI asks the same).

## API

### Tooltip.Root

| Prop                    | Type                      | Default |                                                                                                                                                                                                      |
| ----------------------- | ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`                  | `boolean`                 |         | Opens or closes the tip when it changes, in the browser.                                                                                                                                             |
| `onOpenChange`          | `(open: boolean) => void` |         | Called after the tip opens or closes, whatever did it: hover, focus, Escape, `open`.                                                                                                                 |
| `bind:open`             | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`.                                                                                                                                                             |
| `disabled`              | `boolean`                 | `false` | Hover and focus do not open the tip; `open` still does.                                                                                                                                              |
| `disableHoverablePopup` | `boolean`                 | `false` | Closes the tip as soon as the pointer leaves the trigger, instead of letting it move onto the tip. WCAG 1.4.13 asks for hoverable content: use it only for tips that cover something the user needs. |

### Tooltip.Trigger

| Prop           | Type      | Default |                                                                        |
| -------------- | --------- | ------- | ---------------------------------------------------------------------- |
| `delay`        | `number`  | `600`   | How long the pointer rests on the trigger before the tip opens, in ms. |
| `closeDelay`   | `number`  | `0`     | How long the tip stays after the pointer leaves, in ms.                |
| `closeOnClick` | `boolean` | `true`  | A click (or Enter, or Space) on the trigger closes the tip.            |

The trigger takes a `<button>`'s props too; an `aria-describedby` you pass is kept, after the tip.
These props reach the client script as attributes of the trigger: `data-delay`,
`data-close-delay`, `data-close-on-click="false"`, and `data-trigger-disabled` from `Root`'s
`disabled`.

### Tooltip.Popup

The placement props of [Popover.Popup](popover.md#popoverpopup): `side` (default `"top"`),
`align`, `sideOffset` and `alignOffset`.

## Example

```tsx check
import { Tooltip } from "@lumiose/ui";

export function BoldButton() {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger class="lu-button" aria-label="Bold">
        B
      </Tooltip.Trigger>
      <Tooltip.Popup class="lu-tooltip">Bold (Ctrl+B)</Tooltip.Popup>
    </Tooltip.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-tooltip` on `Popup`: inverted colours, a 6px gap and a fade.

**With your own CSS**, style the tip through `class`, `:popover-open`, `[data-side]` and
`[data-align]`, and the offsets through `--lu-side-offset` and `--lu-align-offset`, as for
[Popover](popover.md#styling). `@lumiose/ui/tooltip.css` holds the placement both share.

## Keyboard and focus

The [WAI-ARIA tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), with Base UI's
and Zag's opening rules:

| Key          | Does                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| Tab          | Focusing the trigger from the keyboard opens the tip at once; leaving closes it. |
| Escape       | Closes the tip, and only the tip: a dialog or popover around it stays open.      |
| Enter, Space | Activate the trigger and close the tip, unless `closeOnClick={false}`.           |

- **Opens** after `delay` of hover with a mouse or a pen, or at once on keyboard focus
  (`:focus-visible`). A touch never opens it, and neither does the focus a mouse click gives.
- **One at a time.** Within 400 ms of another tooltip closing, or while one is open, the next one
  opens without delay, so moving along a toolbar reads each tip.
- **A press before the delay** cancels the opening.
- **Closes** on Escape (only the tip: a dialog or popover around it stays open), on a press, on a
  click of the trigger (unless `closeOnClick={false}`), on blur, and when something around the
  trigger scrolls.
- **Hoverable** (WCAG 1.4.13): the pointer can move from the trigger onto the tip, across the gap,
  and the tip stays; it closes `closeDelay` after the pointer leaves both.

A tooltip inside a popover keeps the popover open, and one inside a dialog belongs inside its
`Popup` (everything outside a modal dialog is inert).

## Without JavaScript, and the client script

Without JavaScript the tip never shows, but the trigger keeps its description: screen readers
announce it. A page that renders a `Tooltip` loads a 2.0 kB (brotli) module once, without the
Lumiose runtime; islands bundle it. It opens and closes every tooltip on the page, and places them
in browsers without CSS anchor positioning.

## Browser support

- **`popover="hint"`**: Chrome and Edge from 133 (complete in 151), Firefox from 149 (complete in
  153). Safari reads it as `popover="manual"`: the client script does the same work there.
- **CSS anchor positioning**: Chrome and Edge 125, Firefox 147, Safari 26. Elsewhere the client
  script places the tip.

## Related

- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Popover](popover.md): a popup with interactive content, opened by a click.
