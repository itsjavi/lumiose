# Menu

> A menu of commands, links, checkbox and radio items and submenus, opened by a button: the trigger's `popovertarget` opens it and CSS anchor positioning places it, so it works in server HTML with no JavaScript, and a 3.7 kB script adds the APG Menu Button keyboard contract where JavaScript runs. `bind:open`, `bind:checked` and `bind:value` keep signals in sync in islands.

```ts
import { Menu } from "@lumiose/ui"; // or "@lumiose/ui/menu"
import "@lumiose/ui/menu.css"; // places the popup next to its trigger and stacks the items
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Menu.Root>
  <Menu.Trigger />
  <Menu.Popup>
    <Menu.Item />
    <Menu.LinkItem />
    <Menu.CheckboxItem />
    <Menu.Separator />
    <Menu.Group>
      <Menu.GroupLabel />
      <Menu.Item />
    </Menu.Group>
    <Menu.RadioGroup>
      <Menu.GroupLabel />
      <Menu.RadioItem />
    </Menu.RadioGroup>
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger />
      <Menu.Popup>…</Menu.Popup>
    </Menu.SubmenuRoot>
  </Menu.Popup>
</Menu.Root>
```

| Part             | Renders                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Root`           | `<lu-menu>`, an element with no box (`display: contents`) that holds the menu's state and adds the keyboard contract.                                |
| `Trigger`        | `<button type="button" popovertarget="…" aria-haspopup="menu">`; `aria-expanded` follows the menu once the script runs.                              |
| `Popup`          | `<div role="menu" popover="auto" tabindex="-1" data-side="…" data-align="…">`, labelled by its trigger; `popover="manual"` once the script opens it. |
| `Item`           | `<button type="button" role="menuitem">`: a command.                                                                                                 |
| `LinkItem`       | `<a role="menuitem">`: a link.                                                                                                                       |
| `CheckboxItem`   | `<button type="button" role="menuitemcheckbox" aria-checked="…">`                                                                                    |
| `Separator`      | `<div role="separator">`                                                                                                                             |
| `Group`          | `<div role="group">`, labelled by its `GroupLabel`.                                                                                                  |
| `GroupLabel`     | `<div role="presentation">`, which names its `Group` or `RadioGroup`.                                                                                |
| `RadioGroup`     | `<div role="group">` of radio items, one of them checked.                                                                                            |
| `RadioItem`      | `<button type="button" role="menuitemradio" value="…" aria-checked="…">`                                                                             |
| `SubmenuRoot`    | `<lu-menu>` for a submenu, inside a `Popup`.                                                                                                         |
| `SubmenuTrigger` | `<button type="button" role="menuitem" popovertarget="…" aria-haspopup="menu">`: an item of the parent menu.                                         |

The trigger and the popup sit inside `Root`; a submenu's trigger and popup sit inside its
`SubmenuRoot`, which sits in the parent's `Popup`, as deep as you like. Items, groups and separators
go inside a `Popup`, radio items inside a `RadioGroup`.

## API

### Menu.Root

| Prop           | Type                      | Default |                                                                                                                                              |
| -------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`         | `boolean`                 |         | Opens or closes the menu when it changes, in the browser. Server HTML always starts closed: a popover opens only from its trigger or script. |
| `onOpenChange` | `(open: boolean) => void` |         | Called after the menu opens or closes, whatever did it: the trigger, a key, a click outside, an item that ran, `open`.                       |
| `bind:open`    | `Signal<boolean>`         |         | Stands in for `open` and `onOpenChange`: the signal opens and closes the menu, and follows it.                                               |

Without `open`, `onOpenChange` or `bind:open` the menu keeps its own state. A menu opened from the
server HTML before its island hydrated stays open, and `onOpenChange(true)` tells the signal.
`Menu.SubmenuRoot` takes the same props, for its submenu.

### Menu.Popup

| Prop          | Type                                                                       | Default                                 |                                                                      |
| ------------- | -------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `side`        | `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"` | `"bottom"`, `"inline-end"` in a submenu | The trigger's side the popup goes on. It flips when it does not fit. |
| `align`       | `"start" \| "center" \| "end"`                                             | `"start"`                               | How the popup aligns with the trigger along that side.               |
| `sideOffset`  | `number`                                                                   |                                         | The gap between the trigger and the popup, in CSS pixels.            |
| `alignOffset` | `number`                                                                   |                                         | A shift along the side, away from the aligned edge, in CSS pixels.   |

### Menu.Item

| Prop           | Type                          | Default |                                                                                                             |
| -------------- | ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `onClick`      | `(event: MouseEvent) => void` |         | Runs the command, on a click, Enter or Space. The menu has closed and focus is back on the trigger by then. |
| `disabled`     | `boolean`                     | `false` | Unavailable (`aria-disabled`): the arrows and typeahead still reach it, but it does not run.                |
| `label`        | `string`                      |         | The text typeahead matches, when the item's text content is not it.                                         |
| `closeOnClick` | `boolean`                     | `true`  | Whether running the item closes the menu.                                                                   |

### Menu.LinkItem

| Prop           | Type      | Default |                                                                                                                                                                              |
| -------------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `href`         | `string`  |         | Where the link goes. A Ctrl, Cmd or Shift click, or a link with `download`, leaves the menu open.                                                                            |
| `label`        | `string`  |         | The text typeahead matches.                                                                                                                                                  |
| `closeOnClick` | `boolean` | `true`  | Whether following the link closes the menu. Base UI keeps it open by default; here it closes, like the other items, since a layout's menu outlives a client-side navigation. |

### Menu.CheckboxItem

| Prop              | Type                         | Default |                                                                              |
| ----------------- | ---------------------------- | ------- | ---------------------------------------------------------------------------- |
| `checked`         | `boolean`                    |         | Checks or unchecks the item when it changes. Pair it with `onCheckedChange`. |
| `defaultChecked`  | `boolean`                    | `false` | Whether it starts checked when `checked` is left out.                        |
| `onCheckedChange` | `(checked: boolean) => void` |         | Called after a click, Enter or Space checks or unchecks it.                  |
| `bind:checked`    | `Signal<boolean>`            |         | Stands in for `checked` and `onCheckedChange`.                               |
| `disabled`        | `boolean`                    | `false` | Unavailable: it can be highlighted, but it does not toggle.                  |
| `label`           | `string`                     |         | The text typeahead matches.                                                  |
| `closeOnClick`    | `boolean`                    | `false` | Whether toggling it closes the menu.                                         |

### Menu.RadioGroup

| Prop            | Type                      | Default |                                                                                        |
| --------------- | ------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `value`         | `string`                  |         | Checks the radio item with this `value` when it changes. Pair it with `onValueChange`. |
| `defaultValue`  | `string`                  |         | The radio item checked at first when `value` is left out.                              |
| `onValueChange` | `(value: string) => void` |         | Called with the `value` of the radio item a click, Enter or Space checks.              |
| `bind:value`    | `Signal<string>`          |         | Stands in for `value` and `onValueChange`.                                             |

### Menu.RadioItem

| Prop           | Type      | Default |                                                            |
| -------------- | --------- | ------- | ---------------------------------------------------------- |
| `value`        | `string`  |         | Required: the value its group takes when it is checked.    |
| `disabled`     | `boolean` | `false` | Unavailable: it can be highlighted, but it is not checked. |
| `label`        | `string`  |         | The text typeahead matches.                                |
| `closeOnClick` | `boolean` | `false` | Whether checking it closes the menu.                       |

### Menu.SubmenuTrigger

| Prop       | Type      | Default |                                                                    |
| ---------- | --------- | ------- | ------------------------------------------------------------------ |
| `disabled` | `boolean` | `false` | Unavailable: it can be highlighted, but its submenu does not open. |
| `label`    | `string`  |         | The text typeahead matches in the parent menu.                     |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers, `ref`) and passes them through. Your props override the defaults (`type`, `tabindex`,
`aria-labelledby`, `data-side`, `data-align`); the roles, `id`, `popovertarget` and the anchor
stay the parts' own, since they connect the parts. Your `style` is kept, after the anchor's.

- **`Trigger`**: `aria-expanded` is left to the browser in server HTML, where `popovertarget`
  implies it, and set by the script once it runs. Disable it with the native `disabled`.
- **`Group`** and **`RadioGroup`**: `aria-labelledby` points at their `GroupLabel` while one
  renders; without one, give the group an `aria-label`.
- **`Separator`**: a horizontal rule between items; `aria-orientation` passes through.

**Differences from Base UI's Menu.** No `Portal`, `Positioner`, `Backdrop` or `Arrow`: the top
layer and anchor positioning replace them, and the placement props go on `Popup`. The menu is not
modal: the page keeps scrolling (the popup follows its trigger), and a press outside closes the
menu and reaches what it lands on. Items render buttons, so they run with Enter and Space without
the script. There are no indicator parts: style `[aria-checked="true"]`. Submenus open on hover
after 100 ms, which no prop changes, and the root trigger does not open on hover.

## Example

A menu in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { Menu } from "@lumiose/ui";

export function ProjectMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger class="lu-button">Project</Menu.Trigger>
      <Menu.Popup class="lu-menu">
        <Menu.LinkItem href="/settings">Settings</Menu.LinkItem>
        <Menu.LinkItem href="/members">Members</Menu.LinkItem>
        <Menu.Separator />
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger>Export</Menu.SubmenuTrigger>
          <Menu.Popup class="lu-menu">
            <Menu.LinkItem href="/export.csv" download>
              CSV
            </Menu.LinkItem>
            <Menu.LinkItem href="/export.json" download>
              JSON
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.SubmenuRoot>
      </Menu.Popup>
    </Menu.Root>
  );
}
```

In an island, with a command, a checkbox item and a radio group bound to signals, and a status
line that follows them. `bind:checked={wrap}` is short for `checked={wrap()}` plus
`onCheckedChange={(next) => wrap.set(next)}`, and `bind:value` likewise.

```tsx check
import { Menu } from "@lumiose/ui";
import { signal } from "lumiose";

export function EditorMenu() {
  const formatted = signal(0);
  const wrap = signal(true);
  const indent = signal("spaces");
  return (
    <>
      <Menu.Root>
        <Menu.Trigger class="lu-button">View</Menu.Trigger>
        <Menu.Popup class="lu-menu" align="end">
          <Menu.Item onClick={() => formatted.set(formatted() + 1)}>Format document</Menu.Item>
          <Menu.Item disabled>Fold all</Menu.Item>
          <Menu.Separator />
          <Menu.CheckboxItem bind:checked={wrap}>Wrap lines</Menu.CheckboxItem>
          <Menu.RadioGroup bind:value={indent}>
            <Menu.GroupLabel>Indent with</Menu.GroupLabel>
            <Menu.RadioItem value="spaces">Spaces</Menu.RadioItem>
            <Menu.RadioItem value="tabs">Tabs</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
      <p>
        Formatted {formatted()} times, lines {wrap() ? "wrap" : "do not wrap"}, indent with{" "}
        {indent()}.
      </p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-menu` on every `Popup`, submenus included, and `lu-button` on
the trigger. `lu-menu` styles the surface, the items (highlighted, disabled, focus ring), the
checkbox and radio marks, the arrow of a submenu trigger, the separators and the group labels, and
fades the popup in and out. Its colours come from the theme's `--lu-` properties
([UI components](README.md#the-default-theme)), and it sets a 4px gap with `--lu-side-offset`.

**With your own CSS**, style the parts through `class` and their state:

- the popup: `:popover-open`, `data-side` and `data-align` (where it was asked to go);
- the trigger and a submenu trigger: `[aria-expanded="true"]` while their menu is open;
- items: `[data-highlighted]` on the item that has focus (by keyboard or pointer),
  `:focus-visible`, `[aria-disabled="true"]`, and `[aria-checked="true"]` on checkbox and radio
  items;
- `[role="separator"]`, `[role="group"]` and a group label's `[role="presentation"]`.

A starting point:

```css
.menu {
  min-inline-size: 10rem;
  padding: 0.25rem;
  border: 1px solid #d4d4d8;
  border-radius: 0.5rem;
  box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.35);
  --lu-side-offset: 4px;
}
.menu [role^="menuitem"] {
  padding: 0.375rem 0.5rem;
  border: 0;
  border-radius: 0.25rem;
  background: none;
  font: inherit;
}
.menu [role^="menuitem"][data-highlighted] {
  background: #f4f4f5;
}
.menu [role^="menuitem"][aria-disabled="true"] {
  opacity: 0.5;
}
.menu [aria-checked="true"]::before {
  content: "✓" / "";
}
```

`@lumiose/ui/menu.css` holds what the menu needs to work, in the `lu.core` layer: `lu-menu` has
no box, and the popup and its groups lay the items out in a column (`display: grid`, items
`display: flex`). It imports the placement rules Menu shares with Popover and Tooltip: with CSS
anchor positioning, a popup sits on its `data-side` and `data-align`, keeps the gaps of
`--lu-side-offset` and `--lu-align-offset`, flips when it does not fit (a submenu tries the other
side, then the other alignment, then below and above its trigger), shrinks to the room beside its
trigger and scrolls when it fits nowhere (the focused item stays in view), and hides while its
trigger is scrolled out of view. The `sideOffset` and `alignOffset` props set those two properties on the
popup.

## Keyboard and focus

The [WAI-ARIA Menu Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/), with
Base UI's behaviour where the pattern leaves a choice:

| Key                       | Does                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space              | On the trigger: opens the menu on its first item. On an item: runs it (a link item too), or checks it. On a submenu trigger: opens it. |
| Arrow Down, Arrow Up      | On the trigger: opens the menu on its first item, or on its last. In the menu: the next or previous item, looping.                     |
| Home, End                 | The first or last item.                                                                                                                |
| Arrow Right (Left in RTL) | On a submenu trigger, or the trigger of a menu in a vertical Toolbar or Menubar: opens it on its first item.                           |
| Arrow Left (Right in RTL) | In a submenu: closes it, back on its trigger.                                                                                          |
| A character               | The next item whose text starts with it; characters typed within 750 ms add up, and Space among them is text.                          |
| Escape                    | Closes one level: the submenu on top, or the menu. Focus goes back to its trigger.                                                     |
| Tab, Shift+Tab            | Close the whole menu. Tab moves on from the trigger; Shift+Tab stays on it.                                                            |

- **On open**, focus moves to the first item that can run (Arrow Up: the last one). Opened by a
  pointer, the popup itself takes focus and no item is highlighted until a key or the pointer
  picks one.
- **On close**, focus returns to the trigger without scrolling the page, after Escape, Tab, an
  item that ran or a click outside on nothing focusable; a click on a button or a field outside
  leaves focus there.
- **Running an item** closes the whole menu and returns focus before the item's `onClick` runs,
  so a handler that opens a dialog gets focus back on the trigger when it closes. Checkbox and
  radio items stay open.
- **Disabled items** (`aria-disabled`) stay in the arrow order and typeahead, as the pattern
  asks, but do not run.
- **The pointer** highlights the item under it, and leaving the items clears the highlight. A
  mouse press on the trigger opens the menu at once: releasing it on an item runs the item, and
  releasing it outside closes the menu. A submenu opens after the pointer rests 100 ms on its
  trigger, and stays open while the pointer heads for it across other items.
- **A click outside** closes the whole menu, submenus included, and a click in a menu closes the
  submenus open from it. A right-click, a middle click or a second finger outside leaves the menu
  open, as in Base UI.

## Without JavaScript, and the client script

The trigger opens the popup with `popovertarget`, and Escape or a click outside closes it: a menu
in a server-rendered page opens before any script loads, and with none. Tab then moves through the
items in order, and links work; commands, which run JavaScript, need it anyway. `open`,
`onOpenChange` and the `bind:` props need the component to run in the browser, in an island.

The keyboard contract comes from a small script: a page that renders a `Menu` loads it once, as a
3.7 kB (brotli) module without the Lumiose runtime, and islands bundle it. It defines `lu-menu`,
which upgrades every menu on the page in place, and adds what the native popover lacks: focus on
open and its return on close, the arrows, Home, End and typeahead, Escape one level at a time, Tab,
submenus, checkbox and radio items, disabled items, `data-highlighted`, and the pointer behaviour
above. It also takes over dismissal, with the model Menu shares with [Popover](popover.md) and
[Combobox](combobox.md): the popup becomes a manual popover when the script opens it, and the
script closes it on a click outside (main button only), on Escape, on a close request such as the
Android back gesture, and when another popup opens outside it. Until it loads (or without JavaScript) the menu behaves as a
native `popover="auto"` of buttons, which any click outside closes.

The element is also an API of its own, for scripts and other frameworks:

- `open`: a property; setting it to `true` or `false` opens or closes the menu.
- `openchange`: an event (not bubbling, like `toggle`) with `detail.open`, after the menu opens or
  closes.
- `checkedchange`: a bubbling event that checkbox and radio items fire with `detail.checked` when
  a click, Enter or Space checks or unchecks them.

## Browser support

- **Popovers and `popovertarget`**: Chrome and Edge 114, Firefox 125, Safari 17.
- **CSS anchor positioning** places the popup: Chrome and Edge 125, Firefox 147, Safari 26
  (partly; 27 fully). Elsewhere the client script places the popup with the same sides,
  alignment, offsets and flips; without JavaScript it shows where the browser shows any popover,
  in the middle of the viewport, and still works.
- **`showPopover({ source })`**, which ties a popup the script opens to its trigger: Chrome 137,
  Firefox 144, Safari 26. Older browsers open it the same way.
- **`CloseWatcher`**, for the Android back gesture on a menu opened by a click, a tap or a key:
  Chrome 126, Firefox 149. Escape is handled on its own in every browser, one layer at a time.
- **Exit animations** that keep the popup in the top layer while it fades (`overlay`) are
  Chromium-only.

## Related

- [UI components](README.md): the approach, styling, the default theme and the other components.
- [Dialog](dialog.md): a menu item can open one; focus returns to the menu's trigger when it
  closes.
- [Islands](https://itsjavi.com/lumiose/docs/concepts/islands/): running a component in the
  browser, for `open`, `onOpenChange` and the `bind:` props.
- [JSX](https://itsjavi.com/lumiose/docs/concepts/jsx/): `bind:`, native events with `on:` and
  `ref`.
