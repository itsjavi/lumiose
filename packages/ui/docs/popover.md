# Popover

> A popup anchored to its trigger: a native `popover` opened and closed by the trigger's `popovertarget`, placed with CSS anchor positioning, so it works in server HTML with no JavaScript. A 2.3 kB script moves focus into it and back, dismisses it as Base UI does (not on a right-click), keeps `aria-expanded` current and places it in browsers without anchor positioning. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands. A trigger can open it on hover (`openOnHover`), and a `modal` popover is a modal `<dialog>` that makes the page behind it inert.

```ts
import { Popover } from "@lumiose/ui"; // or "@lumiose/ui/popover"
import "@lumiose/ui/popover.css"; // places the popup next to its trigger
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Popover.Root>
  <Popover.Trigger />
  <Popover.Popup>
    <Popover.Title />
    <Popover.Description />
    <Popover.Close />
  </Popover.Popup>
</Popover.Root>
```

| Part          | Renders                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`        | No element. Holds the state and the ids the other parts share.                                                                                                              |
| `Trigger`     | `<button type="button" popovertarget="…" aria-haspopup="dialog">`, with an `anchor-name` in its `style`.                                                                    |
| `Popup`       | `<div popover="auto" role="dialog" data-side="…" data-align="…">`, labelled by its `Title` and described by its `Description`; `popover="manual"` once the script opens it. |
| `Title`       | `<h2>`, which names the popup.                                                                                                                                              |
| `Description` | `<p>`, which describes it.                                                                                                                                                  |
| `Close`       | `<button type="button" popovertarget="…" popovertargetaction="hide">`.                                                                                                      |

With `modal`, the `Trigger` is a `<button command="show-modal" commandfor="…">`, the `Popup` a
`<dialog closedby="any" data-side="…" data-align="…">` and the `Close` a
`<button command="close" commandfor="…">`.

The popup is a non-modal dialog, as in Base UI: the page around it stays usable (unless `modal`). A popover may
contain another `Popover.Root`: the inner popup opens on top, and closing the outer one closes
both.

## API

### Popover.Root

| Prop           | Type                      | Default |                                                                                                                                                 |
| -------------- | ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                 |         | Opens or closes the popover when it changes, in the browser. Server HTML always starts closed: a popover opens only from its trigger or script. |
| `onOpenChange` | `(open: boolean) => void` |         | Called after the popover opens or closes, whatever did it: the trigger, a close button, Escape, a click outside, another popover or `open`.     |
| `bind:open`    | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`.                                                                                                        |
| `modal`        | `boolean`                 | `false` | A modal popover: the page behind it is inert and does not scroll, focus stays inside, and a press outside or Escape closes it.                  |

### Popover.Trigger

| Prop          | Type      | Default |                                                                                                                                                          |
| ------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openOnHover` | `boolean` | `false` | A mouse or pen resting on the trigger opens the popover too, and it closes once the pointer has left the trigger and the popup. Not for a modal popover. |
| `delay`       | `number`  | `300`   | With `openOnHover`: how long the pointer rests on the trigger before the popover opens, in ms.                                                           |
| `closeDelay`  | `number`  | `0`     | With `openOnHover`: how long the popover stays open after the pointer leaves, in ms (at least 100 ms to cross the gap to the popup).                     |

A hover opens the popover without moving focus, and a click on the trigger then keeps it open
until it is dismissed. Touch and the keyboard open it with a click (a tap, Enter or Space), as
without `openOnHover`.

### Popover.Popup

| Prop          | Type                                                                       | Default    |                                                                                                |
| ------------- | -------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `side`        | `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"` | `"bottom"` | The trigger's side the popup goes on. `inline-start` and `inline-end` follow `dir`.            |
| `align`       | `"start" \| "center" \| "end"`                                             | `"center"` | How the popup lines up with the trigger along that side.                                       |
| `sideOffset`  | `number`                                                                   | `0`        | The gap between the trigger and the popup, in CSS pixels.                                      |
| `alignOffset` | `number`                                                                   | `0`        | A shift along the side, in CSS pixels: away from the aligned edge, or right/down when centred. |

The popup flips to the opposite side when it does not fit, and goes below (or above) the trigger
when a `left` or `right` popup fits on neither side. It hides while its trigger is scrolled out
of view.

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`type`,
`aria-haspopup`, `role`, `aria-labelledby`, `aria-describedby`); `id`, `popover` and
`popovertarget` stay the parts' own. A `style` you pass keeps the anchor name.

- **`Trigger`**: `aria-expanded` comes from the browser for `popovertarget`, and from the client
  script once it runs.
- **`Popup`**: native events work as on any popover: `on:toggle` and `on:beforetoggle`. A popup
  without a `Title` needs an `aria-label`.

## Example

```tsx check
import { Popover } from "@lumiose/ui";

export function Notifications() {
  return (
    <Popover.Root>
      <Popover.Trigger class="lu-button">Notifications</Popover.Trigger>
      <Popover.Popup class="lu-popover" align="start">
        <Popover.Title>Notifications</Popover.Title>
        <Popover.Description>You are all caught up.</Popover.Description>
        <footer>
          <Popover.Close class="lu-button">Close</Popover.Close>
        </footer>
      </Popover.Popup>
    </Popover.Root>
  );
}
```

In an island, bound to a signal: `bind:open={open}` is short for `open={open()}` plus
`onOpenChange={(next) => open.set(next)}`. A popover opened by the signal still anchors to its
trigger and treats it as its invoker.

```tsx check
import { Popover } from "@lumiose/ui";
import { signal } from "lumiose";

export function Filters() {
  const open = signal(false);
  return (
    <>
      <Popover.Root bind:open={open}>
        <Popover.Trigger class="lu-button">Filters</Popover.Trigger>
        <Popover.Popup class="lu-popover" side="right" sideOffset={8}>
          <Popover.Title>Filters</Popover.Title>
        </Popover.Popup>
      </Popover.Root>
      <p>{open() ? "Choosing filters…" : "All items"}</p>
    </>
  );
}
```

A profile card that opens on hover, and a modal popover with a form:

```tsx check
import { Popover } from "@lumiose/ui";

export function HoverAndModal() {
  return (
    <>
      <Popover.Root>
        <Popover.Trigger class="lu-button" openOnHover delay={200}>
          Ada Lovelace
        </Popover.Trigger>
        <Popover.Popup class="lu-popover" sideOffset={8}>
          <Popover.Title>Ada Lovelace</Popover.Title>
          <Popover.Description>Wrote the first published program.</Popover.Description>
        </Popover.Popup>
      </Popover.Root>
      <Popover.Root modal>
        <Popover.Trigger class="lu-button">Rename</Popover.Trigger>
        <Popover.Popup class="lu-popover" align="start" sideOffset={8}>
          <Popover.Title>Rename the file</Popover.Title>
          <label>
            Name <input class="lu-input" value="report.pdf" />
          </label>
          <footer>
            <Popover.Close class="lu-button">Done</Popover.Close>
          </footer>
        </Popover.Popup>
      </Popover.Root>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-popover` on `Popup`: a surface with the title, the
description and a `<footer>` styled, a 4px gap to the trigger, and a fade. Its colours come from the
theme's `--lu-` properties ([UI components](README.md#the-default-theme)).

**With your own CSS**, style the popup through `class` and its state: `:popover-open` (`[open]`
for a modal popover, whose `::backdrop` is transparent until you style it),
`[data-side]` and `[data-align]` (the requested placement; a flip does not change them), and the
trigger through `[aria-expanded]`. Two custom properties set the offsets, and the props override
them: `--lu-side-offset` and `--lu-align-offset`.

```css
.popover {
  --lu-side-offset: 6px;
  padding: 0.75rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.35);
}
```

`@lumiose/ui/popover.css` holds the placement, in the `lu.core` layer: for each `data-side` and
`data-align`, the CSS anchor positioning that puts the popup next to its trigger, with flips and
`position-visibility: anchors-visible`. Tooltip shares it.

## Keyboard and focus

| Key          | Does                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space | On the trigger: opens or closes the popover.                                                                                     |
| Tab          | Moves through the popup, then on to the element after the trigger. When the trigger is the last element, focus leaves the popup. |
| Shift+Tab    | From the start of the popup, back to the trigger. The popover stays open.                                                        |
| Escape       | Closes the popover on top. With nested popovers, or a popover in a dialog, one Escape closes one layer.                          |

- **On open**, focus moves to the first focusable element in the popup, or to the popup itself
  when it has none. Opened by touch, the popup focuses itself, so no virtual keyboard opens.
- **On close**, focus returns to the trigger without scrolling, unless a click outside landed on
  another control, which keeps it. Escape and the close buttons return it too.
- **A click outside** closes the popover; a right-click or a second finger does not. A press inside a nested popover does not close its
  parent, and opening another popover closes the first.
- Popovers opened from a dialog belong inside its `Popup`: everything outside a modal dialog is
  inert.
- **Opened on hover**, the popover leaves focus where it is; it stays open while the pointer is on
  the trigger or the popup, and Escape closes it without moving the pointer (WCAG 1.4.13).
- **A modal popover** keeps Tab inside it (the page behind it is inert), and Escape, a press
  outside or a close button closes it; focus returns to the trigger.

## Without JavaScript, and the client script

The trigger, the close buttons, Escape, the click outside and the placement are HTML and CSS
features: a popover in a server-rendered page works before any script loads, and with none. So
does a modal popover, through invoker commands and `closedby` (where a browser lacks them,
[Dialog](dialog.md)'s script, which a modal popover loads, stands in). Opening on hover needs the
script.
`open`, `onOpenChange` and `bind:open` need the component to run in an island.

A page that renders a `Popover` loads a 2.3 kB (brotli) module once, without the Lumiose runtime;
islands bundle it. It covers every Popover on the page:

- focus on open (the first focusable element, or the popup) and its return on close;
- dismissal, shared with [Menu](menu.md) and [Combobox](combobox.md): a trigger's click makes the
  popup a manual popover, which the script closes on a click outside (main button only, so a
  right-click or a second finger does not close it, as in Base UI), on Escape and other close
  requests (the Android back gesture), and when another popover opens outside it. Until the
  script loads, the browser's light dismiss closes it on any press outside;
- `aria-expanded` on the triggers;
- the placement in browsers without CSS anchor positioning, which it keeps current on scroll and
  resize;
- opening on hover: the delays, the grace to cross the gap to the popup, and keeping it open after
  a click on the trigger.

## Browser support

- **Popover and `popovertarget`**: every current browser (Baseline 2024).
- **Invoker commands and `closedby`** (a modal popover): Chrome 135, Firefox 144, Safari 26.2 for
  commands; Chrome 134 and Firefox 141 for `closedby`. Elsewhere Dialog's script stands in.
- **CSS anchor positioning**: Chrome and Edge 125, Firefox 147, Safari 26. Elsewhere the client
  script places the popup; without JavaScript there it opens in the middle of the viewport.
- Safari and Firefox do not follow a trigger moved by a CSS `transform`.

## Related

- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Tooltip](tooltip.md): a short tip on hover or focus, with the same placement props.
- [Dialog](dialog.md): a modal popup.
