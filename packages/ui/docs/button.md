# Button

> A native `<button>`, after Base UI's Button. It is `type="button"` unless you say otherwise, so it submits a form only when asked to. Disabled it leaves the tab order; with `focusableWhenDisabled` it stays focusable as `aria-disabled="true"` (a loading state keeps focus where it was) and a tiny script cancels its clicks.

```ts
import { Button } from "@lumiose/ui"; // or "@lumiose/ui/button"
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Button>Save</Button>
```

| Part     | Renders                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| `Button` | `<button type="button">`; `aria-disabled="true"` with `focusableWhenDisabled` |

## API

### Button

| Prop                    | Type      | Default    |                                                                                                            |
| ----------------------- | --------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `type`                  | `string`  | `"button"` | `"submit"` or `"reset"` to act on its form.                                                                |
| `disabled`              | `boolean` | `false`    | Natively disabled: out of the tab order, its clicks ignored.                                               |
| `focusableWhenDisabled` | `boolean` | `false`    | With `disabled`: it stays focusable as `aria-disabled="true"`, and its clicks, Enter and Space do nothing. |

Every other native prop passes through: `name`, `value`, `form`, `command`, `commandfor`,
`popovertarget`, `id`, `class`, `aria-*`, `onClick`.

**Differences from Base UI's Button.** It is always a `<button>`: no `nativeButton` or `render`. For
a link that looks like a button, style an `<a>` with the same class.

## Example

A save button that keeps focus while it saves, in an island:

```tsx check
import { Button } from "@lumiose/ui";
import { signal } from "lumiose";

export function SavingButton() {
  const saving = signal(false);
  return (
    <Button
      class="lu-button"
      data-variant="primary"
      disabled={saving()}
      focusableWhenDisabled
      onClick={() => {
        saving.set(true);
        setTimeout(() => saving.set(false), 1500);
      }}
    >
      {saving() ? "Saving…" : "Save"}
    </Button>
  );
}
```

## Styling

**With the default theme**, put `lu-button` on it (`data-variant="primary"` or
`data-variant="destructive"` for the others): a 36px tall button with a focus ring, faded when
`:disabled` or `[aria-disabled="true"]`.

**With your own CSS**, style the button and its states: `:hover`, `:focus-visible`, `:disabled`,
`[aria-disabled="true"]`.

Button ships no stylesheet: it needs none to work.

## Keyboard and focus

| Key           | Does                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| Enter / Space | Presses it, unless it is disabled.                                            |
| Tab           | Moves on. A disabled button is skipped, unless it is focusable when disabled. |

## Without JavaScript, and the client script

A native button: it works, submits and resets with no script. The client script (0.1 kB brotli)
only cancels the clicks, Enter and Space of an `aria-disabled` button (one without a `role` of its
own); without it such a button still acts, so a server page that disables a button until
something happens should use `disabled` alone.

## Browser support

Native `<button>`: every browser.

## Related

- [Toggle](toggle.md): a button that stays pressed.
- [Form](form.md): a form whose submit button is a Button.
- [Dialog](dialog.md): a Button with `command="show-modal"` opens a dialog without JavaScript.
