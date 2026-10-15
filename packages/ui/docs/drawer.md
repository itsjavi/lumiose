# Drawer

> A panel that slides in from an edge of the window and that a swipe toward that edge closes: a Dialog (a native modal `<dialog>` opened by an invoker command, so it works in server HTML with no JavaScript) against the edge its `swipeDirection` names. A 1 kB script adds the swipe, with the close buttons, Escape and a click on the backdrop as its alternatives. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands.

```ts
import { Drawer } from "@lumiose/ui"; // or "@lumiose/ui/drawer"
import "@lumiose/ui/drawer.css"; // puts the dialog against its edge; locks the page's scroll
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Drawer.Root>
  <Drawer.Trigger />
  <Drawer.Popup>
    <Drawer.Title />
    <Drawer.Description />
    <Drawer.Content />
    <Drawer.Close />
  </Drawer.Popup>
</Drawer.Root>
```

| Part          | Renders                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Root`        | No element. Holds the state and the ids the other parts share, as `Dialog.Root`.                                    |
| `Trigger`     | `<button type="button" command="show-modal" commandfor="…" aria-haspopup="dialog" aria-expanded="…">`, as Dialog's. |
| `Popup`       | `<dialog closedby="any" data-swipe-direction="…">`, labelled by its `Title` and described by its `Description`.     |
| `Content`     | `<div>` around the drawer's content, which may scroll.                                                              |
| `Title`       | `<h2>`, which names the drawer.                                                                                     |
| `Description` | `<p>`, which describes it.                                                                                          |
| `Close`       | `<button type="button" command="close" commandfor="…">`, as Dialog's.                                               |

`Trigger`, `Title`, `Description` and `Close` are [Dialog's](dialog.md#anatomy). A drawer is
modal: the page behind it is inert, and focus stays inside.

## API

### Drawer.Root

| Prop             | Type                                  | Default  |                                                                                                                                                   |
| ---------------- | ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`           | `boolean`                             |          | Opens or closes the drawer when it changes, in the browser. Server HTML always starts closed: a modal dialog opens only from a trigger or script. |
| `onOpenChange`   | `(open: boolean) => void`             |          | Called after the drawer opens or closes, whatever did it: the trigger, a close button, Escape, a click outside, a swipe or `open`.                |
| `bind:open`      | `Signal<boolean>`                     |          | Stands in for `open` and `onOpenChange`.                                                                                                          |
| `swipeDirection` | `"down" \| "up" \| "left" \| "right"` | `"down"` | The direction a swipe closes the drawer in, and the window's edge it sits against: `"down"` is a bottom sheet.                                    |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through, as Dialog's do ([Dialog: API](dialog.md#api)): `closedby`
on `Popup` (`"closerequest"` keeps a click outside from closing it), `on:close` and the close
buttons' `value`.

- **`Content`**: a swipe that starts in content that can still scroll toward the drawer's edge
  scrolls it instead, until it reaches its end. When it scrolls, make it focusable for the
  keyboard: `tabindex={0}` with `role="region"` and an `aria-label`.
- **`[data-swipe-ignore]`** on any element inside keeps swipes from starting on it, as on buttons,
  links and fields.

## Example

A bottom sheet in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Drawer } from "@lumiose/ui";

export function FiltersSheet() {
  return (
    <Drawer.Root>
      <Drawer.Trigger class="lu-button">Filters</Drawer.Trigger>
      <Drawer.Popup class="lu-drawer">
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Swipe down, or press Done, to close.</Drawer.Description>
        <footer>
          <Drawer.Close class="lu-button" data-variant="primary">
            Done
          </Drawer.Close>
        </footer>
      </Drawer.Popup>
    </Drawer.Root>
  );
}
```

In an island, a side drawer bound to a signal: `bind:open={open}` is short for `open={open()}`
plus `onOpenChange={(next) => open.set(next)}`, and the signal follows a swipe too.

```tsx check
import { Drawer } from "@lumiose/ui";
import { signal } from "lumiose";

export function NavigationDrawer() {
  const open = signal(false);
  return (
    <>
      <button type="button" class="lu-button" onClick={() => open.set(true)}>
        Menu
      </button>
      <Drawer.Root bind:open={open} swipeDirection="left">
        <Drawer.Popup class="lu-drawer">
          <Drawer.Title>Menu</Drawer.Title>
          <Drawer.Description>Swipe left to close.</Drawer.Description>
          <Drawer.Close class="lu-button">Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
      <p>{open() ? "The menu is open" : "The menu is closed"}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-drawer` on `Popup`: a surface against its edge, rounded on the
inside, with a handle on a bottom sheet, the title, the description and a `<footer>` styled. It
slides in and out from its edge, follows a swipe, and leaves from where the swipe let go; the
backdrop fades with it.

**With your own CSS**, style the drawer through `class`, `[data-swipe-direction]`, `dialog[open]`
and `::backdrop`, and the swipe through the script's state, named as in Base UI:

- `[data-swiping]` while a swipe runs, with `--drawer-swipe-movement-x` or
  `--drawer-swipe-movement-y` (pixels, toward the edge) and `--drawer-swipe-progress` (0 to 1,
  for the backdrop);
- `[data-swipe-dismiss]` (the direction) when a swipe closed it, until it has left.

```css
.drawer {
  translate: var(--drawer-swipe-movement-x, 0) var(--drawer-swipe-movement-y, 0);
  transition:
    translate 250ms ease-out,
    overlay 250ms allow-discrete,
    display 250ms allow-discrete;
}
.drawer[data-swiping] {
  transition: none;
}
.drawer[data-swipe-direction="down"]:not([open]) {
  translate: 0 100%;
}
@starting-style {
  .drawer[data-swipe-direction="down"][open] {
    translate: 0 100%;
  }
}
```

`@lumiose/ui/drawer.css` holds Dialog's scroll lock and, in the `lu.core` layer, puts each
`dialog[data-swipe-direction]` against its edge, across that edge's length, instead of the
browser's centred box; a swiped drawer selects no text.

## Keyboard and focus

| Key            | Does                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| Enter, Space   | On the trigger: opens the drawer.                                            |
| Tab, Shift+Tab | Move between the focusable elements of the drawer; the page behind is inert. |
| Escape         | Closes the drawer on top.                                                    |

- **Focus** moves into the drawer on open and returns to the trigger on close, a swipe included, as
  with [Dialog](dialog.md#keyboard-and-focus).
- **A swipe** is a dragging movement: the close buttons, Escape and a click on the backdrop close
  the drawer without one (WCAG 2.5.7). Give a drawer a visible close button.
- **The swipe** needs to travel 40% of the drawer's size toward its edge, or to be a quick flick;
  shorter, the drawer springs back. It never starts on a button, link or field.

## Without JavaScript, and the client script

The trigger, the close buttons, Escape and the click outside are HTML features, as for Dialog: a
drawer in a server-rendered page works before any script loads, and with none, against its edge.
`open`, `onOpenChange` and `bind:open` need the component to run in an island.

A page that renders a `Drawer` loads Dialog's script and a 1 kB (brotli) one of its own (1.9 kB
together), without the Lumiose runtime; islands bundle them. The drawer's script handles the
swipe, with the mouse and pen through pointer events and on touch screens through touch events,
taking the gesture from scrolling only once it is a swipe.

Not in this Drawer, next to Base UI's: snap points, a swipe area that opens the drawer from the
edge, indented backgrounds, the virtual keyboard provider, detached triggers (`createHandle`), and
non-modal drawers.

## Browser support

- **`<dialog>`, invoker commands and `closedby`**: as for [Dialog](dialog.md#browser-support).
- **Exit animations** that keep the drawer in the top layer (`overlay`) are Chromium-only.
  Elsewhere it leaves the top layer as soon as it starts closing.

## Related

- [Dialog](dialog.md): the same parts, centred.
- [UI components](README.md): the approach, styling and the other components.
