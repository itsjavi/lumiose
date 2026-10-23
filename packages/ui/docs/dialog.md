# Dialog

> A modal dialog, or an alert dialog that needs an answer: a native `<dialog>` opened and closed by invoker commands, so it works in server HTML with no JavaScript, and a 1.5 kB script closes the native element's gaps where JavaScript runs. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands.

```ts
import { Dialog } from "@lumiose/ui"; // or "@lumiose/ui/dialog"
import "@lumiose/ui/dialog.css"; // locks the page's scroll behind a modal dialog
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Dialog.Root>
  <Dialog.Trigger />
  <Dialog.Popup>
    <Dialog.Title />
    <Dialog.Description />
    <Dialog.Close />
  </Dialog.Popup>
</Dialog.Root>
```

| Part          | Renders                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Root`        | No element. Holds the state and the ids the other parts share.                                                                |
| `Trigger`     | `<button type="button" command="show-modal" commandfor="…" aria-haspopup="dialog" aria-expanded="…">`                         |
| `Popup`       | `<dialog closedby="…">`, labelled by its `Title` and described by its `Description`; `role="alertdialog"` for an alert dialog |
| `Title`       | `<h2>`, which names the dialog.                                                                                               |
| `Description` | `<p>`, which describes it.                                                                                                    |
| `Close`       | `<button type="button" command="close" commandfor="…">`: its `value` becomes the dialog's `returnValue`.                      |

The trigger can sit anywhere inside `Root`, and a popup may have several close buttons. `Title` and
`Description` go inside `Popup`. A dialog may contain another `Dialog.Root`: the inner dialog
opens on top of the outer one.

## API

### Dialog.Root

| Prop           | Type                        | Default    |                                                                                                                                                   |
| -------------- | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                   |            | Opens or closes the dialog when it changes, in the browser. Server HTML always starts closed: a modal dialog opens only from a trigger or script. |
| `onOpenChange` | `(open: boolean) => void`   |            | Called after the dialog opens or closes, whatever did it: the trigger, a close button, Escape, a click outside or `open`.                         |
| `bind:open`    | `Signal<boolean>`           |            | Stands in for `open` and `onOpenChange`: the signal opens and closes the dialog, and follows it.                                                  |
| `role`         | `"dialog" \| "alertdialog"` | `"dialog"` | `"alertdialog"` for a confirmation that needs an answer: a click outside does not close it.                                                       |

Without `open`, `onOpenChange` or `bind:open` the dialog keeps its own state.

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`type`,
`aria-haspopup`, `aria-expanded`, `closedby`, `aria-labelledby`, `aria-describedby`). A `Title`'s or
a `Description`'s `id` names it, and the popup points at it; the `Popup` keeps its own `id`, which
its triggers point at (see [Ids](README.md#ids)), and `command` and `commandfor` stay the parts' own.

- **`Trigger`**: `aria-expanded` follows the dialog in the browser. In server HTML it stays
  `"false"`, which is never wrong where assistive technology can reach it: while the modal dialog
  is open, the trigger is inert.
- **`Popup`**: `closedby` is `"any"` for a dialog (Escape or a click outside closes it) and
  `"closerequest"` for an alert dialog (Escape only); pass `closedby="none"` to allow neither. Native
  events work as on a `<dialog>`: `on:close` runs after any close, and
  `event.currentTarget.returnValue` holds the value of the `Close` that closed it (it is unchanged
  after Escape). To keep a dialog open (unsaved changes, say), use `closedby="none"` while it must
  stay, not `preventDefault()` on its `cancel` event: browsers let a page cancel only the first of
  repeated close requests, so a second Escape closes it anyway.
- **`Title`** and **`Description`**: the popup's `aria-labelledby` and `aria-describedby` point at
  the ones it renders, and only those; in an island they follow parts that appear or go away. A
  dialog without a `Title` needs an `aria-label` on `Popup`.

## Example

A confirmation in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Dialog } from "@lumiose/ui";

export function DeleteProject() {
  return (
    <Dialog.Root role="alertdialog">
      <Dialog.Trigger class="lu-button">Delete project…</Dialog.Trigger>
      <Dialog.Popup class="lu-dialog">
        <Dialog.Title>Delete project?</Dialog.Title>
        <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
        <footer>
          <Dialog.Close class="lu-button" value="cancel">
            Cancel
          </Dialog.Close>
          <Dialog.Close class="lu-button" data-variant="destructive" value="delete">
            Delete
          </Dialog.Close>
        </footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
```

In an island, bound to a signal: the button outside opens it, and the signal follows whatever
closes it. `bind:open={open}` is short for `open={open()}` plus
`onOpenChange={(next) => open.set(next)}`.

```tsx check
import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

export function EditProfile() {
  const open = signal(false);
  const saved = signal("");
  return (
    <>
      <button type="button" class="lu-button" onClick={() => open.set(true)}>
        Edit profile
      </button>
      <Dialog.Root bind:open={open}>
        <Dialog.Popup
          class="lu-dialog"
          on:close={(event) => saved.set(event.currentTarget.returnValue)}
        >
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Description>Your name as others see it.</Dialog.Description>
          <footer>
            <Dialog.Close class="lu-button" data-variant="primary" value="save">
              Save
            </Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Root>
      <p>{open() ? "Editing…" : `Last answer: ${saved() || "none"}`}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-dialog` on `Popup` and `lu-button` on the buttons
(`data-variant="primary"` or `"destructive"` for filled ones). `lu-dialog` also styles the backdrop,
the title, the description and a `<footer>` for the buttons, and fades and zooms the dialog in and
out. Its colours come from the theme's `--lu-` properties ([UI components](README.md#the-default-theme)).

**With your own CSS**, style the parts through `class` and the dialog's native state: `dialog[open]`,
`:modal`, `::backdrop` and `[role="alertdialog"]`. Where the client script runs, a dialog with open
dialogs inside also gets `data-nested-dialog-open` and `--lu-nested-dialogs` (how many are open inside
it), as in Base UI; `dialog:has(dialog[open])` matches the same dialogs without the script. A starting point, with a fade that keeps the dialog in the top layer while it
closes:

```css
.dialog {
  inline-size: min(28rem, 100vw - 2rem);
  padding: 1.25rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.75rem;
  box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.35);
}
.dialog::backdrop {
  background: rgb(0 0 0 / 0.45);
}

@media (prefers-reduced-motion: no-preference) {
  .dialog,
  .dialog::backdrop {
    transition:
      opacity 150ms ease-out,
      overlay 150ms allow-discrete,
      display 150ms allow-discrete;
  }
  .dialog:not([open]),
  .dialog:not([open])::backdrop {
    opacity: 0;
  }
  @starting-style {
    .dialog[open],
    .dialog[open]::backdrop {
      opacity: 0;
    }
  }
}
```

`@lumiose/ui/dialog.css` holds the scroll lock, in the `lu.core` layer: the page behind any modal
`<dialog>` does not scroll (`:root:has(dialog:modal) { overflow: hidden }`). A page that overflows
keeps its scrollbar's space (`scrollbar-gutter: stable`), so with classic scrollbars (Windows,
Linux) its layout does not shift. A page that fits the window gets no gutter, which would leave an
empty strip of about 15px at its inline end. The client script measures the page before the dialog
opens; without it, a scroll timeline in the stylesheet tells the two apart (decision-79), and a
browser without scroll timelines keeps the gutter on a page that fits too
([Browser support](#browser-support)). Leave the stylesheet out, or override the rule, to let the
page scroll.

## Keyboard and focus

The browser's modal dialog provides the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

| Key            | Does                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space   | On the trigger: opens the dialog.                                                                                                                                      |
| Tab, Shift+Tab | Move between the focusable elements of the dialog. The page behind is inert: focus never reaches it.                                                                   |
| Escape         | Closes the dialog on top, alert dialogs included. With nested dialogs, one Escape closes one dialog. An Escape that ends an input method's composition closes nothing. |

- **On open**, focus moves to the element with `autofocus`, or else the first tab stop inside,
  or else the dialog, as in Base UI and the same in every browser: not a scroller before it, nor a
  `tabindex="-1"` title (where the script runs). Opened by touch, the dialog focuses itself
  instead, so no virtual keyboard opens over it (an `autofocus` element still gets focus).
- **On close**, focus returns to the element that had it before: the trigger, or the button that
  set the signal. If that element is gone, focus goes to another trigger of the dialog, without
  scrolling the page. The popovers, menus and dialogs open inside it close with it.
- **A click outside** closes a dialog, not an alert dialog, and only the dialog on top. A press
  that starts inside and ends outside, such as selecting text, does not count, and neither does a
  right-click or a second finger.
- Popups opened from a dialog (a menu, a select) belong inside its `Popup`: everything outside a
  modal dialog is inert.

## Without JavaScript, and the client script

The trigger, the close buttons, Escape and the click outside are HTML features: a dialog in a
server-rendered page works before any script loads, and with none. `open`, `onOpenChange`,
`bind:open` and a live `aria-expanded` need the component to run in the browser, in an island.

Where the native element falls short of Base UI's dialog, a small script closes the gap: a page
that renders a `Dialog` loads it once, as a 1.5 kB (brotli) module without the Lumiose runtime, and
an island loads the same module. It covers every `<dialog>` on the page:

- a right-click or a second finger outside does not close the dialog;
- `data-nested-dialog-open` and `--lu-nested-dialogs` on a dialog with open dialogs inside;
- the first tab stop takes focus on open, in every browser, and a dialog opened by touch focuses
  itself;
- focus returns without scrolling, to the opener or, if it is gone, another trigger (WebKit, which
  does not focus a clicked button, would otherwise leave focus on the page);
- the click outside where the browser lacks `closedby` (Safari), and the invoker commands where it
  lacks them.

Until the script loads (or without JavaScript) the dialog behaves as the browser's own.

## Browser support

- **Invoker commands** (`command`, `commandfor`) open and close the dialog: Chrome and Edge 135,
  Firefox 144, Safari 26.2. In older browsers the client script stands in for them; without
  JavaScript the trigger and the close buttons do nothing there.
- **`closedby`**: Chrome 134 and Firefox 141; Safari only in Technology Preview. Elsewhere the
  client script closes the dialog on a click outside; without JavaScript only Escape does.
- **Exit animations** that keep the dialog in the top layer (`overlay`) are Chromium-only.
  Elsewhere the dialog leaves the top layer as soon as it starts closing.
- **Scroll timelines** (`animation-timeline: scroll()`) keep the scroll lock's gutter off a page
  that fits the window without JavaScript: Chrome and Edge 115, Safari 26. In Firefox, until the
  client script runs or without JavaScript, such a page keeps the gutter while a dialog is open:
  with classic scrollbars, an empty strip at its inline end.

## Related

- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Islands](https://itsjavi.com/lumiose/docs/concepts/islands/): running a component in the browser, for `open` and
  `onOpenChange`.
- [JSX](https://itsjavi.com/lumiose/docs/concepts/jsx/): native events with `on:` and `ref`.
