# Context Menu

> A menu opened at the pointer by a right-click in its trigger area, a long press on a touch screen, or Shift+F10 and the ContextMenu key: Menu's popup and items, with Menu's keys, typeahead, submenus and dismissal. A 0.6 kB script on top of Menu's (3.9 kB together) opens it; without JavaScript the browser shows its own menu. `bind:open` (or `open` and `onOpenChange`) keeps a signal in sync in islands.

```ts
import { ContextMenu } from "@lumiose/ui"; // or "@lumiose/ui/context-menu"
import "@lumiose/ui/context-menu.css"; // Menu's layout, and no iOS callout over the area
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<ContextMenu.Root>
  <ContextMenu.Trigger />
  <ContextMenu.Popup>
    <ContextMenu.Item />
    <ContextMenu.LinkItem />
    <ContextMenu.CheckboxItem />
    <ContextMenu.Separator />
    <ContextMenu.Group>
      <ContextMenu.GroupLabel />
      <ContextMenu.Item />
    </ContextMenu.Group>
    <ContextMenu.RadioGroup>
      <ContextMenu.GroupLabel />
      <ContextMenu.RadioItem />
    </ContextMenu.RadioGroup>
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger />
      <ContextMenu.Popup>…</ContextMenu.Popup>
    </ContextMenu.SubmenuRoot>
  </ContextMenu.Popup>
</ContextMenu.Root>
```

| Part                      | Renders                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`                    | `<lu-context-menu>`, an element with no box (`display: contents`) around the area and the menu; it opens the menu.                                               |
| `Trigger`                 | `<div>`: the area whose right-click, long press or keys open the menu.                                                                                           |
| `Popup`                   | Menu's `<lu-menu>` with its `<div role="menu" popover="auto" data-side="…" data-align="…">`, anchored to a zero-size `<span aria-hidden="true">` at the pointer. |
| `Item` … `SubmenuTrigger` | Menu's parts, as [Menu](menu.md#anatomy) renders them.                                                                                                           |

The popup has no trigger button to be named by: give it an `aria-label`. Inside a `SubmenuRoot`,
`Popup` is the submenu's, placed next to its trigger as in Menu.

## API

### ContextMenu.Root

| Prop           | Type                      | Default |                                                                                                                                                            |
| -------------- | ------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                 |         | Opens or closes the menu when it changes, in the browser, where it last opened (the window's top start corner at first). Server HTML always starts closed. |
| `onOpenChange` | `(open: boolean) => void` |         | Called after the menu opens or closes, whatever did it: a right-click, a long press, a key, an item, Escape, a click outside or `open`.                    |
| `bind:open`    | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`.                                                                                                                   |
| `disabled`     | `boolean`                 | `false` | The area keeps the browser's own menu.                                                                                                                     |

### ContextMenu.Popup

Menu's [popup props](menu.md#menupopup), from the pointer: `side` (default `"bottom"`), `align`
(default `"start"`), `sideOffset` (default `0`: the popup's corner at the pointer) and
`alignOffset`. It flips when it does not fit.

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through.

- **`Trigger`**: for the keys, focus must be in the area: give it `tabindex={0}` (and a name, such
  as `aria-label`), or focusable content.
- **The items**: Menu's `Item`, `LinkItem`, `CheckboxItem`, `RadioGroup`, `RadioItem`, `Group`,
  `GroupLabel`, `Separator`, `SubmenuRoot` and `SubmenuTrigger`, with
  [Menu's props](menu.md#api): `disabled`, `label`, `closeOnClick`, `checked` and
  `onCheckedChange`, `value` and `onValueChange`, and `bind:`.

## Example

A file's actions in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { ContextMenu } from "@lumiose/ui";

export function FileActions() {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger class="file" tabindex={0} aria-label="report.pdf">
        report.pdf
      </ContextMenu.Trigger>
      <ContextMenu.Popup class="lu-menu" aria-label="File actions">
        <ContextMenu.Item>Rename</ContextMenu.Item>
        <ContextMenu.Item>Duplicate</ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger>Move to</ContextMenu.SubmenuTrigger>
          <ContextMenu.Popup class="lu-menu">
            <ContextMenu.Item>Archive</ContextMenu.Item>
            <ContextMenu.Item>Trash</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.SubmenuRoot>
      </ContextMenu.Popup>
    </ContextMenu.Root>
  );
}
```

In an island, with a checkbox item and a radio group bound to signals:

```tsx check
import { ContextMenu } from "@lumiose/ui";
import { signal } from "lumiose";

export function GalleryOptions() {
  const grid = signal(true);
  const sort = signal("name");
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger class="gallery" tabindex={0} aria-label="Gallery">
          Right-click the gallery
        </ContextMenu.Trigger>
        <ContextMenu.Popup class="lu-menu" aria-label="View options">
          <ContextMenu.CheckboxItem bind:checked={grid}>Show the grid</ContextMenu.CheckboxItem>
          <ContextMenu.RadioGroup bind:value={sort}>
            <ContextMenu.GroupLabel>Sort by</ContextMenu.GroupLabel>
            <ContextMenu.RadioItem value="name">Name</ContextMenu.RadioItem>
            <ContextMenu.RadioItem value="date">Date</ContextMenu.RadioItem>
          </ContextMenu.RadioGroup>
        </ContextMenu.Popup>
      </ContextMenu.Root>
      <p>
        {grid() ? "Grid" : "No grid"}, sorted by {sort()}
      </p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-menu` on each `Popup`, as on a Menu's: a surface with its
items, checkbox and radio marks, separators and group labels. The theme leaves the area to you.

**With your own CSS**, style the popup and items as a Menu's ([Menu: Styling](menu.md#styling)):
`:popover-open`, `[data-highlighted]`, `[aria-checked]`, `[aria-disabled]`, `[data-side]`. The
element sets `--lu-context-x` and `--lu-context-y` (the pointer, in pixels) on the root.

`@lumiose/ui/context-menu.css` holds Menu's rules and two of its own, in the `lu.core` layer:
`<lu-context-menu>` adds no box, and the area has `-webkit-touch-callout: none`, so iOS shows no
preview over the menu on a long press.

## Keyboard and focus

| Key                           | Does                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Shift+F10, ContextMenu        | With focus in the area: opens the menu below the focused element, on its first item. |
| Arrow keys, Home, End, typing | Menu's: move between items, open and close submenus, typeahead.                      |
| Enter, Space                  | Run the item (checkbox and radio items toggle and stay open).                        |
| Escape                        | Closes the menu (one submenu at a time).                                             |
| Tab, Shift+Tab                | Close the menu.                                                                      |

- **A right-click or a long press** opens the menu with focus on the popup: the arrows then reach
  the items. A right-click inside the open menu does nothing; another one in the area moves the
  menu there.
- **On close**, focus returns to where it was before the menu opened (the area, for the keys),
  unless a click outside landed on a control, which keeps it.
- **A long press** (500ms, one finger, moving less than 10px) is the touch alternative to the
  right-click, and the keys the keyboard one (WCAG 2.5.1). Offer the menu's commands elsewhere too
  when they matter: a context menu is hard to discover.

## Without JavaScript, and the client script

Opening a menu at the pointer needs the script: without JavaScript a right-click shows the
browser's own menu, and the popup stays hidden. `open`, `onOpenChange` and `bind:open` need the
component to run in an island.

A page that renders a `ContextMenu` loads Menu's script and a 0.6 kB (brotli) one of its own,
3.9 kB together, without the Lumiose runtime; islands bundle them. The element opens the menu on a
right-click, a long press or the keys, at the pointer, through a zero-size anchor that it moves
there (CSS anchor positioning places the popup, with Menu's flips; without it, the shared
placement script does). Menu's script does the rest: keys, items, submenus, and dismissal shared
with [Popover](popover.md) and [Combobox](combobox.md).

## Browser support

- **CSS anchor positioning**: Chrome and Edge 125, Firefox 147, Safari 26. Elsewhere the script
  places the popup at the pointer.
- **Long press**: iOS fires no `contextmenu` on one, so the script times it; Android's
  `contextmenu` after a long press is ignored.
- **The ContextMenu key and Shift+F10**: Windows and Linux keyboards; on macOS, only Shift+F10
  where the keyboard has F10.

## Related

- [Menu](menu.md): the same popup and items, opened by a button.
- [UI components](README.md): the approach, styling and the other components.
