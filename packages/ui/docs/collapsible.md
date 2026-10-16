# Collapsible

> A panel that its trigger shows and hides: a native `<details>` whose `<summary>` is the trigger, so it works in server HTML with no JavaScript, keeps the browser's keyboard handling, and opens when find-in-page or a link lands inside it. A 0.7 kB script adds Base UI's animation hooks. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands.

```ts
import { Collapsible } from "@lumiose/ui"; // or "@lumiose/ui/collapsible"
import "@lumiose/ui/collapsible.css"; // a disabled trigger ignores the pointer
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Collapsible.Root>
  <Collapsible.Trigger />
  <Collapsible.Panel />
</Collapsible.Root>
```

| Part      | Renders                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `Root`    | `<details>`, `open` while the panel shows.                                                  |
| `Trigger` | `<summary aria-controls="…">`, the first child of `Root`: it opens and closes the panel.    |
| `Panel`   | `<div>`, the rest of the `<details>`: the browser hides it while the `<details>` is closed. |

The browser exposes the `<summary>` as a button with its expanded state, so the trigger has no
`aria-expanded` of its own. HTML allows one heading inside a `<summary>`, for a trigger that
titles a section (Accordion renders its headings that way).

## API

### Collapsible.Root

| Prop           | Type                      | Default |                                                                                                                                                   |
| -------------- | ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                 |         | Opens or closes the panel when it changes. Server HTML starts as it says.                                                                         |
| `defaultOpen`  | `boolean`                 | `false` | Whether the panel starts open, when there is no `open`.                                                                                           |
| `onOpenChange` | `(open: boolean) => void` |         | Called after the panel opens or closes, whatever did it: the trigger, find-in-page, a link, another item of its `name`; not when it renders open. |
| `bind:open`    | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`.                                                                                                          |
| `disabled`     | `boolean`                 | `false` | The trigger takes no focus and does not toggle the panel.                                                                                         |

Without `open`, `onOpenChange` or `bind:open` the element keeps its own state. `Root` takes the
props of a `<details>` too: `name` makes collapsibles with the same name an exclusive group, where
opening one closes the others.

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. The `Trigger`'s `id` names it, and the `Panel` points at
it; the `Panel` keeps its own `id`, which the trigger points at (see [Ids](README.md#ids)), and
`aria-controls` stays the trigger's own.

- **`Trigger`**: a disabled trigger gets `aria-disabled="true"` and `tabindex="-1"`.
- **`Panel`**: the client script sets `--lu-collapsible-panel-height` and `--lu-collapsible-panel-width`
  on it while it opens and closes, and `data-starting-style` and `data-ending-style`
  ([Styling](#styling)).

## Example

A section in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Collapsible } from "@lumiose/ui";

export function RecoveryKeys() {
  return (
    <Collapsible.Root class="lu-collapsible">
      <Collapsible.Trigger>Recovery keys</Collapsible.Trigger>
      <Collapsible.Panel>
        <p>Store these keys somewhere safe: each one lets you back in once.</p>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
```

In an island, bound to a signal: `bind:open={open}` is short for `open={open()}` plus
`onOpenChange={(next) => open.set(next)}`.

```tsx check
import { Collapsible } from "@lumiose/ui";
import { signal } from "lumiose";

export function AdvancedOptions() {
  const open = signal(false);
  return (
    <>
      <Collapsible.Root class="lu-collapsible" bind:open={open}>
        <Collapsible.Trigger>Advanced options</Collapsible.Trigger>
        <Collapsible.Panel>Proxy, timeouts and retries.</Collapsible.Panel>
      </Collapsible.Root>
      <p>{open() ? "Showing the advanced options" : "Advanced options hidden"}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-collapsible` on `Root`: the trigger becomes a row with a
chevron that turns while the panel is open, and the panel's height animates.

**With your own CSS**, style the parts through `class` and `[open]` on the root. The client script
gives the panel what Base UI's does, for an open and close animation: `--lu-collapsible-panel-height`
(the content's height in pixels while it moves, `auto` once open), `data-starting-style` for the
frame an opening starts from and `data-ending-style` while it closes. The browser hides the panel
as soon as the `<details>` closes, so keep it visible while it closes with a transition on
`::details-content`:

```css
.collapsible > .panel {
  overflow: hidden;
  block-size: var(--lu-collapsible-panel-height, auto);
  transition: block-size 200ms ease-out;
}
.collapsible > .panel:is([data-starting-style], [data-ending-style]) {
  block-size: 0;
}
.collapsible::details-content {
  transition: content-visibility 200ms allow-discrete;
}
```

A panel rendered open does not animate. `@lumiose/ui/collapsible.css` holds one rule, in the
`lu.core` layer: a disabled trigger (`summary[aria-disabled="true"]`) ignores the pointer.

## Keyboard and focus

| Key          | Does                                                                |
| ------------ | ------------------------------------------------------------------- |
| Enter, Space | On the trigger: opens or closes the panel.                          |
| Tab          | Moves to the trigger, then into the open panel's focusable content. |

The trigger is a `<summary>`, so the browser handles its keys and its focus. A disabled trigger is
out of the tab order.

## Without JavaScript, and the client script

Opening and closing, the exclusive group of a `name`, and find-in-page are HTML features: a
Collapsible in a server-rendered page works before any script loads, and with none. A disabled
trigger ignores the pointer through CSS. `open`, `onOpenChange` and `bind:open` need the component
to run in an island.

A page that renders a `Collapsible` loads a 0.7 kB (brotli) module once, without the Lumiose
runtime; islands bundle it. It covers every Collapsible and [Accordion](accordion.md) panel on the
page:

- the animation hooks above, set on every opening and closing, whatever caused it (the trigger,
  find-in-page, a link, the `open` prop, another item of the group);
- a disabled trigger does not toggle, also from the keyboard.

## Browser support

- **`<details>` and `<summary>`**: every browser. **`name`** (exclusive groups): Chrome 120,
  Firefox 130, Safari 17.2.
- **Find-in-page and links into a closed panel** open it: Chrome 97, Firefox 139. Safari has not
  shipped it yet (WebKit bug 304174): there, find-in-page skips a closed panel.
- **`::details-content`**, which the closing transition needs: Chrome 131, Firefox 143, Safari
  18.4. Elsewhere the panel disappears at once when it closes.

## Related

- [Accordion](accordion.md): a stack of collapsible items, with arrow keys between them.
- [UI components](README.md): the approach, styling and the other components.
- [Theming](theming.md): the default theme's classes and custom properties.
