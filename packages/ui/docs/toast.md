# Toast

> Short notices in a region of their own, after Base UI's toast: server HTML renders them (a form action's result), and islands add, update and close them through a toast manager. `<lu-toast-viewport>`, a 2.8 kB light-DOM element, puts them in the top layer, times them (pausing on hover and focus), limits how many show, closes them on a swipe, Escape or their close button, focuses the region on F6, and makes screen readers announce them.

```ts
import { Toast } from "@lumiose/ui"; // or "@lumiose/ui/toast"
import "@lumiose/ui/toast.css"; // the viewport's box, the limit, swipes on touch screens
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Toast.Provider>
  <Toast.Viewport>
    <Toast.Root>
      <Toast.Content>
        <Toast.Title />
        <Toast.Description />
      </Toast.Content>
      <Toast.Action />
      <Toast.Close />
    </Toast.Root>
  </Toast.Viewport>
</Toast.Provider>
```

| Part          | Renders                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Provider`    | No element. Holds the toasts' defaults (`timeout`, `limit`) and a manager for `Toast.useToastManager()`.         |
| `Viewport`    | `<lu-toast-viewport role="region" aria-label="Notifications (F6)" tabindex="-1">`, the toasts' region.           |
| `Root`        | `<div role="status" aria-atomic="true">`, a toast: `role="alert"` for a high-priority one.                       |
| `Content`     | `<div>`, around the text.                                                                                        |
| `Title`       | `<h2>`: its children, or else the toast's `title`; nothing without either.                                       |
| `Description` | `<p>`: its children, or else the toast's `description`; nothing without either.                                  |
| `Action`      | `<button type="button">` with the toast's `actionProps`; nothing without them or children.                       |
| `Close`       | `<button type="button" command="--close-toast" commandfor="…">`: a custom invoker command that closes the toast. |

Each toast is a live region of its own, `role="status"` (announced when the reader is idle) or
`role="alert"` (announced at once), as in Zag; Base UI's are non-modal dialogs. The viewport is
a named region that F6 reaches.

## API

### Toast.createToastManager

`Toast.createToastManager()` returns a manager. Create one in a module and import it where toasts
are added and where they are shown: islands of a page share a module, so they share its manager.

| Method                      | Does                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `toasts()`                  | The open toasts, newest first, read reactively: map them to `Toast.Root`s.                                                          |
| `add(options)`              | Adds a toast and returns its id. With the `id` of an open toast, it updates that one in place.                                      |
| `update(id, options)`       | Changes an open toast in place: the same object, its fields read reactively, so its parts update without a new element.             |
| `close(id?)`                | Closes a toast, or every toast: it gets `transitionStatus: "ending"` and `data-ending-style`, then leaves after its exit animation. |
| `promise(promise, options)` | Shows a loading toast while `promise` runs (it stays), then turns it into a success or an error toast; returns `promise`.           |

The options of `add` and `update`:

| Option        | Type                              | Default |                                                                                                                                                                                                                                                                                                    |
| ------------- | --------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`                          | made up | An id of your own, to update or close the toast later.                                                                                                                                                                                                                                             |
| `title`       | `string`                          |         | Shown by `Toast.Title`.                                                                                                                                                                                                                                                                            |
| `description` | `string`                          |         | Shown by `Toast.Description`.                                                                                                                                                                                                                                                                      |
| `type`        | `string`                          |         | A type of your own (`"success"`, `"error"`, `"loading"`): the toast's `data-type`, for styling.                                                                                                                                                                                                    |
| `timeout`     | `number`                          | `5000`  | Milliseconds before it closes on its own; `0` keeps it until closed. The provider's `timeout` sets the default.                                                                                                                                                                                    |
| `priority`    | `"low" \| "high"`                 | `"low"` | `"high"` announces it at once (`role="alert"`), for errors that need attention.                                                                                                                                                                                                                    |
| `actionProps` | `JSX.IntrinsicElements["button"]` |         | The props of its `Toast.Action`: `children` for the label, `onClick`, `class`, `disabled` and `aria-*`. Other keys are dropped, so options passed as they arrived (a notification payload) cannot set the button's `type`, `formaction` or `style`. Write any other prop on `Toast.Action` itself. |
| `onClose`     | `() => void`                      |         | Called when it starts closing.                                                                                                                                                                                                                                                                     |
| `onRemove`    | `() => void`                      |         | Called once it is removed, after its exit animation.                                                                                                                                                                                                                                               |

`promise`'s options are `loading`, `success` and `error`: options, a title, or (for `success` and
`error`) a function of the result. The loading toast has `type: "loading"` and `timeout: 0`; the
others `type: "success"` or `"error"` and the default timeout.

### Toast.Provider

| Prop           | Type           | Default   |                                                                                                                                      |
| -------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `toastManager` | `ToastManager` | a new one | The manager its toasts come from, for `Toast.useToastManager()`.                                                                     |
| `timeout`      | `number`       | `5000`    | Milliseconds before a toast closes on its own; `0` keeps toasts open.                                                                |
| `limit`        | `number`       | `3`       | How many toasts show at once; older ones wait, hidden and paused, until a newer one closes. The toast that holds focus always shows. |

`Toast.useToastManager()` returns the closest provider's manager.

### Toast.Root

| Prop             | Type                                      | Default             |                                                                  |
| ---------------- | ----------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `toast`          | `ToastObject \| ToastOptions`             |                     | The toast: one from a manager, or a plain object in server HTML. |
| `swipeDirection` | `("up" \| "down" \| "left" \| "right")[]` | `["down", "right"]` | The directions a swipe closes it in; `[]` turns swiping off.     |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`role`, `aria-label`,
`type`). A `Root`'s `id` names the toast's element, and its `Close` points at it (see
[Ids](README.md#ids)); `command` and `commandfor` stay the parts' own, since they connect them.

- **`Viewport`**: rename the region with `aria-label`; keep the hotkey in it.
- **`Root`**: the script fires a cancelable `close` event on it when a toast should close (a close
  button, Escape, a swipe, its timer); a managed toast handles it through its manager.
- **`Close`**: name it, with text or `aria-label`.

## Example

In an island, a button and the toasts it adds, styled by the default theme:

```tsx check
import { Toast } from "@lumiose/ui";

export function SaveButton() {
  const toasts = Toast.createToastManager();
  return (
    <Toast.Provider toastManager={toasts}>
      <button
        type="button"
        class="lu-button"
        onClick={() => toasts.add({ title: "Saved", description: "Your changes are live." })}
      >
        Save
      </button>
      <Toast.Viewport class="lu-toast-viewport">
        {toasts.toasts().map((toast) => (
          <Toast.Root class="lu-toast" toast={toast}>
            <Toast.Title />
            <Toast.Description />
            <Toast.Close aria-label="Close">×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Provider>
  );
}
```

A promise toast, and an error that stays (`timeout: 0`) with an action:

```tsx check
import { Toast } from "@lumiose/ui";

export function UploadButton() {
  const toasts = Toast.createToastManager();
  const upload = () =>
    toasts
      .promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
        loading: "Uploading…",
        success: "Uploaded",
        error: "Upload failed",
      })
      .catch(() => undefined);
  const fail = () =>
    toasts.add({
      title: "Payment failed",
      description: "Check your card and try again.",
      type: "error",
      priority: "high",
      timeout: 0,
      actionProps: { children: "Retry", class: "lu-button", onClick: upload },
    });
  return (
    <Toast.Provider toastManager={toasts}>
      <button type="button" class="lu-button" onClick={upload}>
        Upload
      </button>
      <button type="button" class="lu-button" data-variant="destructive" onClick={fail}>
        Pay
      </button>
      <Toast.Viewport class="lu-toast-viewport">
        {toasts.toasts().map((toast) => (
          <Toast.Root class="lu-toast" toast={toast}>
            <Toast.Title />
            <Toast.Description />
            <Toast.Action />
            <Toast.Close aria-label="Close">×</Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Provider>
  );
}
```

A form action's result in server HTML, with no island: the page renders the toast, and the
script times and closes it.

```tsx check
import { Toast } from "@lumiose/ui";

export function SaveResult(props: { saved: boolean }) {
  return (
    <Toast.Viewport class="lu-toast-viewport">
      {props.saved && (
        <Toast.Root class="lu-toast" toast={{ title: "Project saved" }}>
          <Toast.Title />
          <Toast.Close aria-label="Close">×</Toast.Close>
        </Toast.Root>
      )}
    </Toast.Viewport>
  );
}
```

To add toasts from several islands, create the manager in a module and import it in each: one
island renders the viewport from it, the others call `toasts.add()`.

```ts
// src/toasts.ts
import { Toast } from "@lumiose/ui";

export const toasts = Toast.createToastManager();
```

## Styling

**With the default theme**, put `lu-toast-viewport` on `Viewport` and `lu-toast` on each `Root`: a
column at the window's bottom end, popover surfaces with the title, description and a 28px close
button, a slide in, a fade out, and a swipe that leaves in its direction. `data-type="error"`
adds a red edge.

**With your own CSS**, style the parts through `class` and the script's state:

- `[data-type]`, from the toast's `type`;
- `[data-starting-style]` on a new toast's first frame, and `[data-ending-style]` while it closes
  (the script, or the manager, waits for its animations before removing it);
- `[data-swiping]`, `[data-swipe-direction]` (`up`, `down`, `left`, `right`) and the
  `--lu-toast-swipe-movement-x` and `--lu-toast-swipe-movement-y` variables, in pixels, while a swipe
  runs; `[data-swipe-direction]` stays while a swiped toast leaves;
- `--lu-toast-index` on each shown toast (0 for the first child), and `[data-limited]` on the ones
  past the limit;
- `[data-expanded]` on the viewport while the pointer or keyboard focus is in it.

```css
.toast {
  translate: var(--lu-toast-swipe-movement-x, 0) var(--lu-toast-swipe-movement-y, 0);
  transition:
    opacity 200ms,
    translate 200ms;
}
.toast:is([data-starting-style], [data-ending-style]) {
  opacity: 0;
}
.toast[data-swiping] {
  transition: none;
}
```

`@lumiose/ui/toast.css`, in the `lu.core` layer, makes the viewport a box fixed to the window's
bottom end, without a popover's default border, padding or centring; hides the toasts past the
limit whatever display your CSS gives them; sets `touch-action` on swipeable toasts, so a swipe
does not scroll the page along its axes, while pinch-zoom still works (where `touch-action` knows
it: not in Safari); and gives the page `scroll-padding-block-end` the height of the shown toasts
(`--lu-toast-stack-block-size`, which the script keeps on the root), so a control that takes focus
is scrolled clear of them (WCAG 2.4.11).

A modal dialog makes everything outside it inert, so while one is open the region moves into it,
and back when it closes or leaves the page.

## Keyboard and focus

| Key       | Does                                                                 |
| --------- | -------------------------------------------------------------------- |
| F6        | Focuses the toasts' region, when a toast shows.                      |
| Tab       | Moves through the toasts' buttons.                                   |
| Escape    | In a toast: closes it. On the region: returns focus to where it was. |
| Shift+Tab | On the region: returns focus to where it was.                        |

- **When the focused toast closes**, focus moves to the next toast's first button, or back to
  where it was before it entered the region (F6, Tab or a click).
- **Timers pause** while the pointer is over the region, while keyboard focus is in it, while the
  window is in the background and while the page is hidden; they resume with the time that was
  left. A press that focuses a toast pauses it only while the pointer stays, as in Base UI.
- **A swipe** closes the toast past 40px, unless it is pulled back 10px or more from its farthest
  point before the release.
- **Swipes** have a single-pointer alternative, the close button, and a keyboard one, Escape
  (WCAG 2.5.1 and 2.5.7). A swipe never starts on a button, link or field.
- **Time limits** (WCAG 2.2.1): a toast that times out must hold nothing the reader needs to act
  on. Give a toast with an action, or with something to read twice, `timeout: 0`.
- **Over a modal dialog**: a modal dialog makes everything outside it inert, so while one is open
  the region moves into it, and back when it closes. Toasts stay usable and announced.
- **Persistent**: a press in a toast does not close an open menu, popover or combobox.

## Without JavaScript, and the element's script

What is server-rendered and what needs the client:

| Server HTML                                                                   | The element's script (2.8 kB, loaded once per page, as an island loads it)                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The region and the toasts a page renders, with their text, roles and buttons. | The top layer (a manual popover), so toasts sit above dialogs and survive other popovers' light dismiss. |
| Toasts show at the window's bottom end (`toast.css`).                         | Timers, pausing, the limit, closing (button, Escape, swipe), F6, focus when a toast goes.                |
|                                                                               | The announcement mutation, and following modal dialogs.                                                  |

Without JavaScript a server-rendered toast stays on the page until the next one, and its close
button does nothing. The manager needs an island.

**Announcements.** Each toast is a live region, so screen readers read it without moving focus
(WCAG 4.1.3). Safari's VoiceOver misses the text of a region inserted with it, so 250ms after a
toast appears the script adds an invisible word joiner to it, a change VoiceOver reads, as Base UI
does. A toast in the page's HTML is announced the same way once the script runs.

## Browser support

- **Popover**: every current browser. Without it, toasts stay out of the top layer.
- **Invoker commands** (`Toast.Close`): Chrome 135, Firefox 144, Safari 26.2; elsewhere the
  script handles the close button's click.

## Related

- [UI components](README.md): the approach, styling and the other components.
- [Dialog](dialog.md): a modal popup, which the toasts' region follows.
- [Data and actions](https://lumiose.dev/docs/concepts/data-and-actions/): a form action's result, for a server-rendered toast.
