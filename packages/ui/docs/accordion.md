# Accordion

> A stack of items whose triggers show and hide their panels, after the WAI-ARIA accordion pattern: each item is a native `<details>`, one open at a time through the browser's exclusive group (`name`) or several, so it works in server HTML with no JavaScript and find-in-page opens the item it lands in. `<lu-accordion>`, a 1 kB light-DOM element, adds the arrow keys and Base UI's animation hooks. `bind:value` (or `value` and `onValueChange`) keeps a signal in sync.

```ts
import { Accordion } from "@lumiose/ui"; // or "@lumiose/ui/accordion"
import "@lumiose/ui/accordion.css"; // the root is a block; disabled triggers ignore the pointer
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Accordion.Root>
  <Accordion.Item>
    <Accordion.Header>
      <Accordion.Trigger />
    </Accordion.Header>
    <Accordion.Panel />
  </Accordion.Item>
</Accordion.Root>
```

| Part      | Renders                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `Root`    | `<lu-accordion>`, around the items.                                                                                |
| `Item`    | `<details name="…">`, right inside `Root`, `open` while its panel shows; no `name` when several may be open.       |
| `Header`  | `<h3>` around the trigger's label: inside the `<summary>`, where HTML allows a heading.                            |
| `Trigger` | `<summary aria-controls="…">`, the first child of `Item`: it opens and closes the panel.                           |
| `Panel`   | `<div role="region" aria-labelledby="…">`, labelled by its trigger; the browser hides it while the item is closed. |

HTML puts a heading inside a `<summary>`, not a `<summary>` inside a heading, so `Header` renders
its `<h3>` inside the trigger's `<summary>`: the trigger names the heading, and the browser
exposes the `<summary>` as a button with its expanded state. Set `aria-level` on `Header` for
another heading level.

## API

### Accordion.Root

| Prop            | Type                         | Default      |                                                                                                                   |
| --------------- | ---------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `value`         | `string[]`                   |              | The values of the open items: opens and closes them when it changes. Server HTML starts as it says.               |
| `defaultValue`  | `string[]`                   | `[]`         | The items open at first, when there is no `value`.                                                                |
| `onValueChange` | `(value: string[]) => void`  |              | Called after an item opens or closes, with the values of the open items.                                          |
| `bind:value`    | `Signal<string[]>`           |              | Stands in for `value` and `onValueChange`.                                                                        |
| `multiple`      | `boolean`                    | `false`      | Several items may be open at once. By default opening one closes the other, and only the first value starts open. |
| `disabled`      | `boolean`                    | `false`      | Every item is disabled.                                                                                           |
| `orientation`   | `"vertical" \| "horizontal"` | `"vertical"` | The direction the arrow keys follow: Up and Down, or Left and Right.                                              |
| `loopFocus`     | `boolean`                    | `true`       | The arrow keys go from the last trigger to the first and back.                                                    |

Without `value`, `onValueChange` or `bind:value` the items keep their own state.

### Accordion.Item

| Prop           | Type                      | Default          |                                                           |
| -------------- | ------------------------- | ---------------- | --------------------------------------------------------- |
| `value`        | `string`                  | an id of its own | Identifies the item in the root's `value`.                |
| `disabled`     | `boolean`                 | `false`          | Its trigger takes no focus and does not toggle the panel. |
| `onOpenChange` | `(open: boolean) => void` |                  | Called after the item opens or closes.                    |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. `id`, `name`, `aria-controls` and `aria-labelledby` stay
the parts' own, since they connect the parts.

- **`Trigger`**: a disabled trigger gets `aria-disabled="true"` and `tabindex="-1"`.
- **`Panel`**: the client script sets `--lu-accordion-panel-height` and `--lu-accordion-panel-width` on
  it while it opens and closes, and `data-starting-style` and `data-ending-style`
  ([Styling](#styling)).

## Example

A FAQ in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Accordion } from "@lumiose/ui";

export function ShippingFaq() {
  return (
    <Accordion.Root class="lu-accordion" defaultValue={["shipping"]}>
      <Accordion.Item value="shipping">
        <Accordion.Header>
          <Accordion.Trigger>When will my order ship?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Within two working days.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="returns">
        <Accordion.Header>
          <Accordion.Trigger>Can I return it?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Yes, within 30 days, for free.</Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="gifts" disabled>
        <Accordion.Header>
          <Accordion.Trigger>Gift cards</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Coming soon.</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
```

In an island, several items open, bound to a signal: `bind:value={open}` is short for
`value={open()}` plus `onValueChange={(next) => open.set(next)}`.

```tsx check
import { Accordion } from "@lumiose/ui";
import { signal } from "lumiose";

export function SettingsSections() {
  const open = signal(["profile"]);
  return (
    <>
      <Accordion.Root class="lu-accordion" multiple bind:value={open}>
        <Accordion.Item value="profile">
          <Accordion.Header>
            <Accordion.Trigger>Profile</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Your name and photo.</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="security">
          <Accordion.Header>
            <Accordion.Trigger>Security</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Password and recovery keys.</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
      <p>Open: {open().join(", ") || "none"}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-accordion` on `Root`: items between borders, triggers as rows
with a chevron that turns while the item is open, and panels whose height animates.

**With your own CSS**, style the parts through `class`, `[open]` on the items and
`[aria-disabled]` on the triggers. The client script gives each panel what Base UI's does, for an
open and close animation: `--lu-accordion-panel-height` (the content's height in pixels while it
moves, `auto` once open), `data-starting-style` for the frame an opening starts from and
`data-ending-style` while it closes. The browser hides a panel as soon as its item closes, so keep
it visible while it closes with a transition on `::details-content`:

```css
.accordion > details > .panel {
  overflow: hidden;
  block-size: var(--lu-accordion-panel-height, auto);
  transition: block-size 200ms ease-out;
}
.accordion > details > .panel:is([data-starting-style], [data-ending-style]) {
  block-size: 0;
}
.accordion > details::details-content {
  transition: content-visibility 200ms allow-discrete;
}
```

Opening an item closes the open one, and both animate. `@lumiose/ui/accordion.css`, in the
`lu.core` layer, makes `<lu-accordion>` a block, keeps a trigger's heading on the line of the
`<summary>`'s marker (`display: inline`), and makes a disabled trigger ignore the pointer.

## Keyboard and focus

The [WAI-ARIA accordion pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/), with its
optional keys, as in Base UI:

| Key            | Does                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space   | On a trigger: opens or closes its item.                                                                                   |
| Tab, Shift+Tab | Move through the triggers and the open panels' content.                                                                   |
| Down, Up       | Move focus to the next or the previous trigger; Right and Left when `orientation="horizontal"`, swapped in right-to-left. |
| Home, End      | Move focus to the first or the last trigger.                                                                              |

- **Disabled triggers** are out of the tab order, and the arrow keys skip them.
- **Looping**: from the last trigger, Down goes to the first, unless `loopFocus={false}`.

## Without JavaScript, and the element's script

Opening and closing, one open item at a time (the `name` group), find-in-page and links into a
closed item are HTML features: an accordion in a server-rendered page works before any script
loads, and with none. Disabled triggers ignore the pointer through CSS. `value`, `onValueChange`
and `bind:value` need the component to run in an island.

A page that renders an `Accordion` loads a 1 kB (brotli) module once, without the Lumiose runtime;
islands bundle it. It defines `<lu-accordion>`, which adds the arrow keys, Home and End, and sets
the panels' animation hooks (shared with [Collapsible](collapsible.md)); a disabled trigger does
not toggle, also from the keyboard.

## Browser support

- **`<details name>`** (one open item at a time): Chrome 120, Firefox 130, Safari 17.2. Older
  browsers let several items open.
- **Find-in-page and links into a closed item** open it: Chrome 97, Firefox 139. Safari has not
  shipped it yet (WebKit bug 304174): there, find-in-page skips a closed item.
- **`::details-content`**, which the closing transition needs: Chrome 131, Firefox 143, Safari
  18.4. Elsewhere a panel disappears at once when its item closes.

## Related

- [Collapsible](collapsible.md): one panel and its trigger.
- [Tabs](tabs.md): one panel at a time, from a tab list.
- [UI components](README.md): the approach, styling and the other components.
