# Menubar

> A bar of menus, such as an app's File, Edit and View, after Base UI's Menubar and the WAI-ARIA menubar pattern: `Menu.Root`s inside `<lu-menubar role="menubar">`, whose triggers are the bar's items. Menu's popups, items, submenus and dismissal; the bar is one tab stop, the arrow keys move between its items and between open menus, and once a menu is open, hovering another item opens its menu instead. A 1.1 kB script on top of Menu's (5.5 kB together); without JavaScript each trigger opens its menu.

```ts
import { Menu, Menubar } from "@lumiose/ui"; // or "@lumiose/ui/menu" and "@lumiose/ui/menubar"
import "@lumiose/ui/menubar.css"; // Menu's layout, and the bar's row (or column)
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Menubar>
  <Menu.Root>
    <Menu.Trigger />
    <Menu.Popup>
      <Menu.Item />
      <Menu.SubmenuRoot>
        <Menu.SubmenuTrigger />
        <Menu.Popup>…</Menu.Popup>
      </Menu.SubmenuRoot>
    </Menu.Popup>
  </Menu.Root>
  <Menu.Root>…</Menu.Root>
</Menubar>
```

| Part                       | Renders                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Menubar`                  | `<lu-menubar role="menubar" aria-orientation="…" data-orientation="…">`: a row of the menus (a column when vertical). |
| `Menu.Root` inside it      | Menu's `<lu-menu>`, with `role="none"`.                                                                               |
| `Menu.Trigger` inside it   | Menu's `<button popovertarget="…">`, with `role="menuitem"`: an item of the bar.                                      |
| `Menu.Popup` and the items | As in [Menu](menu.md#anatomy).                                                                                        |

A menubar's items are the triggers of its menus, each inside its `<lu-menu role="none">`, as in
the APG example. Give the bar an `aria-label`.

## API

### Menubar

| Prop          | Type                         | Default        |                                                                                                                                                     |
| ------------- | ---------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Which way the items run. Vertical: Arrow Up and Down move between them, the arrow that points at a popup opens it, and popups go at the inline end. |
| `loopFocus`   | `boolean`                    | `true`         | Whether the arrows wrap from the last item to the first and back.                                                                                   |

Every other prop passes through to `<lu-menubar>`: `class`, `style`, `aria-label`, `data-*`.

### The menus

Each `Menu.Root` keeps [Menu's props](menu.md#api): `open`, `onOpenChange` and `bind:open` per
menu, and its items' `bind:checked` and `bind:value`. `disabled` on a `Menu.Trigger` takes the menu
out of the bar: no focus, no opening.

**Differences from Base UI's Menubar.** No `modal` (the page stays scrollable and usable while a
menu is open) and no `disabled` on the bar: disable each trigger instead. No `render`.

## Example

An editor's menus in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Menu, Menubar } from "@lumiose/ui";

export function EditorMenus() {
  return (
    <Menubar aria-label="Editor" class="lu-menubar">
      <Menu.Root>
        <Menu.Trigger>File</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.Item>New file</Menu.Item>
          <Menu.Item>Open…</Menu.Item>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
            <Menu.Popup class="lu-menu">
              <Menu.Item>Email</Menu.Item>
              <Menu.Item>Copy link</Menu.Item>
            </Menu.Popup>
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.Item>Undo</Menu.Item>
          <Menu.Item>Redo</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Popup class="lu-menu">
          <Menu.RadioGroup defaultValue="100">
            <Menu.GroupLabel>Zoom</Menu.GroupLabel>
            <Menu.RadioItem value="75">75%</Menu.RadioItem>
            <Menu.RadioItem value="100">100%</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    </Menubar>
  );
}
```

In an island, a checkbox item bound to a signal and an item that writes a status line:

```tsx check
import { Menu, Menubar } from "@lumiose/ui";
import { signal } from "lumiose";

export function DocumentMenus() {
  const wrap = signal(false);
  const status = signal("Not saved yet");
  return (
    <>
      <Menubar aria-label="Document" class="lu-menubar">
        <Menu.Root>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.Item onClick={() => status.set("Saved")}>Save</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
        <Menu.Root>
          <Menu.Trigger>Edit</Menu.Trigger>
          <Menu.Popup class="lu-menu">
            <Menu.CheckboxItem bind:checked={wrap}>Word wrap</Menu.CheckboxItem>
          </Menu.Popup>
        </Menu.Root>
      </Menubar>
      <p>
        {status()}; word wrap is {wrap() ? "on" : "off"}
      </p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-menubar` on `Menubar` and `lu-menu` on each `Menu.Popup`: a
bordered bar of the triggers, the one whose menu is open filled, with a focus ring.

**With your own CSS**, style the bar through `class` and `[data-orientation]`, the items as
`lu-menubar > lu-menu > [role="menuitem"]` with `[aria-expanded="true"]` for the open one, and
`[data-has-submenu-open]` on the bar while a menu is open. The popups and items are
[Menu's](menu.md#styling).

`@lumiose/ui/menubar.css` holds Menu's rules and, in the `lu.core` layer, makes `<lu-menubar>` a
flex row (a column when vertical); each `<lu-menu>` adds no box.

## Keyboard and focus

| Key                            | Does                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                 | Enter and leave the bar, which is one tab stop: the item focused last (the first, if that one goes, is disabled or hidden).      |
| Arrow Right, Arrow Left        | On an item: the next or previous item (Down and Up when vertical; swapped right to left). An open menu follows to the next item. |
| Home, End                      | The first or last item.                                                                                                          |
| A letter                       | The next item whose label starts with it.                                                                                        |
| Arrow Down, Enter, Space       | Open the item's menu on its first item (Arrow Up: the last one). Vertical: the arrow that points at the popup opens it.          |
| Arrow Right, Arrow Left (menu) | On an item that opens no submenu: close the menu and open the next or previous one. Vertical: the arrow pointing back closes it. |
| Escape                         | Closes the menu (a submenu first) and returns to its item.                                                                       |

- **The pointer**: a click opens or closes a menu; once one is open, hovering another item opens
  its menu instead. Inside a menu, Menu's rules apply: hover highlights, submenus open on hover.
- **Focus** returns to the item when its menu closes, as in Menu. Disabled triggers are skipped.

## Without JavaScript, and the client script

Each trigger opens its menu through `popovertarget`, and the browser light-dismisses it: without
JavaScript every trigger is a tab stop, and the menus open with Enter, Space or a click.

A page that renders a `Menubar` loads Menu's script and a 1.1 kB (brotli) one of its own, 5.5 kB
together, without the Lumiose runtime; an island loads the same modules. The menubar's script makes the bar one
tab stop once the page has loaded, and adds the arrow keys between items and menus and the hover
switching. Each menu stays Menu's: its keys, items, submenus and dismissal.

## Browser support

As for [Menu](menu.md#browser-support): popovers everywhere current, CSS anchor positioning in
Chrome, Edge, Firefox 147 and Safari 26 (elsewhere the script places the popups).

## Related

- [Menu](menu.md): one menu, opened by a button.
- [Navigation Menu](navigation-menu.md): site navigation with panels of links.
- [UI components](README.md): the approach, styling and the other components.
