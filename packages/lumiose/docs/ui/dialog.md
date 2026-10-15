# Dialog

> A modal dialog, or an alert dialog that needs an answer: a native `<dialog>` opened and closed by invoker commands, so it works in server HTML with no JavaScript. `open` and `onOpenChange` keep a signal in sync in islands.

```ts
import { Dialog } from "@lumiose/ui"; // or "@lumiose/ui/dialog"
import "@lumiose/ui/dialog.css"; // optional: locks the page's scroll behind a modal dialog
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

| Part          | Renders                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `Root`        | No element. Holds the state and the ids the other parts share.                                                  |
| `Trigger`     | `<button type="button" command="show-modal" commandfor="…" aria-haspopup="dialog">`                             |
| `Popup`       | `<dialog closedby="…" aria-labelledby="…" aria-describedby="…">`, with `role="alertdialog"` for an alert dialog |
| `Title`       | `<h2>`, which names the dialog.                                                                                 |
| `Description` | `<p>`, which describes it.                                                                                      |
| `Close`       | `<button type="button" command="close" commandfor="…">`: its `value` becomes the dialog's `returnValue`.        |

The parts work anywhere inside `Root`: the trigger can sit apart from the popup, and a popup may
have several close buttons. Place `Root` around a dialog per dialog.

## API

### Dialog.Root

| Prop           | Type                        | Default    |                                                                                                                                                   |
| -------------- | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                   |            | Opens or closes the dialog when it changes, in the browser. Server HTML always starts closed: a modal dialog opens only from a trigger or script. |
| `onOpenChange` | `(open: boolean) => void`   |            | Called after the dialog opens or closes, whatever did it: the trigger, a close button, Escape, a click outside or `open`.                         |
| `role`         | `"dialog" \| "alertdialog"` | `"dialog"` | `"alertdialog"` for a confirmation that needs an answer: a click outside does not close it.                                                       |

Without `open` and `onOpenChange` the dialog keeps its own state.

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`type`,
`aria-haspopup`, `closedby`, `aria-labelledby`, `aria-describedby`); `id`, `command` and
`commandfor` stay the parts' own, since they connect the parts.

- **`Popup`**: `closedby` is `"any"` for a dialog (Escape or a click outside closes it) and
  `"closerequest"` for an alert dialog (Escape only); pass `closedby="none"` to allow neither. Native
  events work as on a `<dialog>`: `on:close` runs after any close, and
  `event.currentTarget.returnValue` holds the value of the `Close` that closed it (it is unchanged
  after Escape).
- **`Title`** and **`Description`**: the popup points `aria-labelledby` and `aria-describedby` at
  them. A dialog without a `Description` leaves that reference empty, which assistive technology
  ignores; pass `aria-describedby={undefined}` to `Popup` to drop it.

## Example

A confirmation in a server-rendered page, with no island:

```tsx check
import { Dialog } from "@lumiose/ui";

export function DeleteProject() {
  return (
    <Dialog.Root role="alertdialog">
      <Dialog.Trigger class="button">Delete project…</Dialog.Trigger>
      <Dialog.Popup class="dialog">
        <Dialog.Title>Delete project?</Dialog.Title>
        <Dialog.Description>This removes the project and its deployments.</Dialog.Description>
        <footer>
          <Dialog.Close class="button" value="cancel">
            Cancel
          </Dialog.Close>
          <Dialog.Close class="button danger" value="delete">
            Delete
          </Dialog.Close>
        </footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
}
```

In an island, bound to a signal: the button outside opens it, and the signal follows whatever
closes it.

```tsx check
import { Dialog } from "@lumiose/ui";
import { signal } from "lumiose";

export function EditProfile() {
  const open = signal(false);
  const saved = signal("");
  return (
    <>
      <button type="button" onClick={() => open.set(true)}>
        Edit profile
      </button>
      <Dialog.Root open={open()} onOpenChange={(next) => open.set(next)}>
        <Dialog.Popup
          class="dialog"
          on:close={(event) => saved.set(event.currentTarget.returnValue)}
        >
          <Dialog.Title>Edit profile</Dialog.Title>
          <Dialog.Close value="save">Save</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Root>
      <p>{open() ? "Editing…" : `Last answer: ${saved() || "none"}`}</p>
    </>
  );
}
```

## Styling

The package ships no look. Style the parts through `class` and the dialog's native state:
`dialog[open]`, `:modal`, `::backdrop`, `[role="alertdialog"]`. A starting point, with a fade that
keeps the dialog in the top layer while it closes:

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

`@lumiose/ui/dialog.css` holds one rule, in the `lu` layer: the page behind any modal `<dialog>`
does not scroll (`:root:has(dialog:modal) { overflow: hidden }`). Leave the stylesheet out, or
override the rule, to let it scroll.

## Keyboard and focus

The browser's modal dialog provides the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

| Key            | Does                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Enter, Space   | On the trigger: opens the dialog.                                                                    |
| Tab, Shift+Tab | Move between the focusable elements of the dialog. The page behind is inert: focus never reaches it. |
| Escape         | Closes the dialog, alert dialogs included.                                                           |

- **On open**, focus moves to the first focusable element inside, or to the one with `autofocus`.
- **On close**, focus returns to the element that had it before: the trigger, or the button that
  set the signal.
- A click outside closes a dialog, not an alert dialog.

## Without JavaScript

The trigger, the close buttons, Escape and the click outside are HTML features: a dialog in a
server-rendered page works before any script loads, and with none. `open` and `onOpenChange` need
the component to run in the browser, in an island.

## Browser support

The trigger and the close buttons use invoker commands (`command` and `commandfor`): Chrome and
Edge 135, Firefox 144 and Safari 26.2. In older browsers they do nothing. Where `closedby` is not
supported, a click outside does not close the dialog; Escape still does.

## Related

- [UI components](README.md): the approach, styling and the other components.
- [Islands](../concepts/islands.md): running a component in the browser, for `open` and
  `onOpenChange`.
- [JSX](../concepts/jsx.md): native events with `on:` and `ref`.
