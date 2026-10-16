# Navigation Menu

> A site's navigation whose items open panels of links, after Base UI's NavigationMenu and the WAI-ARIA disclosure navigation pattern: a `<nav>` landmark around a list, each trigger opening its content through `popovertarget` (a native popover placed under it by CSS anchor positioning), so the links work and the panels open on a click, one at a time, in server HTML with no JavaScript. A 2.1 kB script adds hover intent, the arrow keys, closing when focus leaves and the direction a panel comes in from. `bind:value` (or `value` and `onValueChange`) keeps the open item in a signal.

```ts
import { NavigationMenu } from "@lumiose/ui"; // or "@lumiose/ui/navigation-menu"
import "@lumiose/ui/navigation-menu.css"; // places each content next to its trigger
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<NavigationMenu.Root>
  <NavigationMenu.List>
    <NavigationMenu.Item>
      <NavigationMenu.Trigger>
        <NavigationMenu.Icon />
      </NavigationMenu.Trigger>
      <NavigationMenu.Content>
        <NavigationMenu.Link />
      </NavigationMenu.Content>
    </NavigationMenu.Item>
    <NavigationMenu.Item>
      <NavigationMenu.Link />
    </NavigationMenu.Item>
  </NavigationMenu.List>
</NavigationMenu.Root>
```

| Part      | Renders                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| `Root`    | `<nav data-orientation="…">` inside `<lu-navigation-menu>`, an element with no box; a `<div>` when nested. |
| `List`    | `<ul>` of the items.                                                                                       |
| `Item`    | `<li data-value="…">`: a trigger with its content, or a link.                                              |
| `Trigger` | `<button type="button" popovertarget="…">`; `aria-expanded` follows its content where the script runs.     |
| `Icon`    | `<span aria-hidden="true">` inside the trigger, such as a chevron.                                         |
| `Content` | `<div popover="auto" data-side="…" data-align="…">` of links, anchored to its trigger.                     |
| `Link`    | `<a>`; `aria-current="page"` and `data-active` when `active`.                                              |

Give `Root` an `aria-label` ("Main") when the page has more than one `<nav>`. A `Root` inside a
`Content` is a nested menu: a `<div>`, inside its parent's landmark. Focus, the pointer or a click
in it keep its parent's content open.

## API

### NavigationMenu.Root

| Prop            | Type                              | Default        |                                                                                                                     |
| --------------- | --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `value`         | `string \| null`                  |                | The `value` of the item whose content is open, or `null`; opens or closes them when it changes, in the browser.     |
| `defaultValue`  | `string \| null`                  | `null`         | The item open at first, in the browser, when `value` is left out.                                                   |
| `onValueChange` | `(value: string \| null) => void` |                | Called after a content opens (its item's `value`) or the open one closes (`null`), whatever did it.                 |
| `bind:value`    | `Signal<string \| null>`          |                | Stands in for `value` and `onValueChange`.                                                                          |
| `delay`         | `number`                          | `50`           | How long the pointer rests on a trigger before its content opens, in milliseconds.                                  |
| `closeDelay`    | `number`                          | `50`           | How long after the pointer leaves an item its content closes, in milliseconds (300 while it heads for the content). |
| `orientation`   | `"horizontal" \| "vertical"`      | `"horizontal"` | Which way the items run: vertical moves with Arrow Up and Down and places contents at the inline end.               |

Server HTML always starts closed: a popover only opens from its trigger or script.

### NavigationMenu.Item

| Prop    | Type     | Default        |                                         |
| ------- | -------- | -------------- | --------------------------------------- |
| `value` | `string` | a generated id | The value `Root`'s `value` names it by. |

### NavigationMenu.Content

| Prop          | Type                                                                       | Default                                   |                                                 |
| ------------- | -------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `side`        | `"top" \| "bottom" \| "left" \| "right" \| "inline-start" \| "inline-end"` | `"bottom"` (`"inline-end"` when vertical) | The trigger's side it goes on; it flips to fit. |
| `align`       | `"start" \| "center" \| "end"`                                             | `"center"` (`"start"` when vertical)      | How it aligns with the trigger along that side. |
| `sideOffset`  | `number`                                                                   |                                           | The gap to the trigger, in CSS pixels.          |
| `alignOffset` | `number`                                                                   |                                           | A shift along the side, in CSS pixels.          |

### NavigationMenu.Link

| Prop           | Type      | Default |                                                                               |
| -------------- | --------- | ------- | ----------------------------------------------------------------------------- |
| `active`       | `boolean` | `false` | The link to the current page: `aria-current="page"`.                          |
| `closeOnClick` | `boolean` | `false` | Whether following it closes the open content (every level, in a nested menu). |

### The other parts

Each part takes the props of the element it renders (`class`, `style`, `aria-*`, `data-*`, event
handlers) and passes them through: `href` and `target` on a `Link`, `disabled` on a `Trigger`.

**Differences from Base UI's NavigationMenu.** Each `Content` is its own popover in the top layer,
anchored to its trigger: there is no shared `Viewport`, `Popup`, `Positioner`, `Portal`,
`Backdrop` or `Arrow`, and so no `--popup-width` and `--popup-height` to animate one box between
contents. `data-activation-direction` lets a content slide in from where the previous one was. No
`actionsRef`, `onOpenChangeComplete`, `keepMounted` or `render`.

## Example

A site's main navigation in a server-rendered page, with no island, styled by the default theme:

```tsx check
import { NavigationMenu } from "@lumiose/ui";

export function MainNavigation() {
  return (
    <NavigationMenu.Root aria-label="Main" class="lu-navigation-menu">
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>
            Products <NavigationMenu.Icon>▾</NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul>
              <li>
                <NavigationMenu.Link href="#analytics">Analytics</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#automation">Automation</NavigationMenu.Link>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger>
            Learn <NavigationMenu.Icon>▾</NavigationMenu.Icon>
          </NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <ul>
              <li>
                <NavigationMenu.Link href="#guides">Guides</NavigationMenu.Link>
              </li>
              <li>
                <NavigationMenu.Link href="#blog">Blog</NavigationMenu.Link>
              </li>
            </ul>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#pricing" active>
            Pricing
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
```

In an island, the open item in a signal:

```tsx check
import { NavigationMenu } from "@lumiose/ui";
import { signal } from "lumiose";

export function SiteNavigation() {
  const open = signal<string | null>(null);
  return (
    <>
      <NavigationMenu.Root aria-label="Site" bind:value={open} class="lu-navigation-menu">
        <NavigationMenu.List>
          <NavigationMenu.Item value="docs">
            <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#start">Getting started</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="community">
            <NavigationMenu.Trigger>Community</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#forum">Forum</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
      <p>Open: {open() ?? "none"}</p>
    </>
  );
}
```

## Styling

**With the default theme**, put `lu-navigation-menu` on `Root`: the list in a row (a column when
vertical), the triggers and links as 36px targets, the current page underlined, an open trigger
filled with its icon turned, and each content a surface of links that fades and slides in.

**With your own CSS**, style the parts through `class`, the triggers' `[aria-expanded="true"]`,
links' `[aria-current="page"]`, and the contents' `:popover-open`, `[data-side]` and
`[data-activation-direction]` (`left`, `right`, `up` or `down`: where the content's trigger is from
the trigger of the content that was open before; absent when none was):

```css
.panel {
  transition:
    opacity 150ms,
    translate 150ms,
    overlay 150ms allow-discrete,
    display 150ms allow-discrete;
}
.panel:not(:popover-open) {
  opacity: 0;
}
@starting-style {
  .panel[data-activation-direction="right"]:popover-open {
    translate: 1rem 0;
  }
}
```

`@lumiose/ui/navigation-menu.css`, in the `lu.core` layer, holds the shared placement rules that put
each content next to its trigger, with the same flips as Popover and Menu, and gives
`<lu-navigation-menu>` no box.

## Keyboard and focus

| Key                     | Does                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab          | Every trigger and link is a tab stop; from an open trigger, Tab goes into its content.                      |
| Enter, Space            | On a trigger: opens or closes its content.                                                                  |
| Arrow Right, Arrow Left | Between the top-level triggers and links (Down and Up when vertical; swapped right to left).                |
| Home, End               | The first or last top-level trigger or link.                                                                |
| Arrow Down              | On a trigger: opens its content on its first link (Arrow Right when vertical). In a content: the next link. |
| Arrow Up                | In a content: the previous link.                                                                            |
| Escape                  | Closes the open content and returns to its trigger.                                                         |

- **The pointer**: resting on a trigger opens its content after `delay`, at once while another one
  is open; leaving the item closes it after `closeDelay`, unless a click kept it open. A click
  toggles a content; a click outside closes it.
- **Focus** leaving an open item for elsewhere on the page closes its content. It is a navigation
  landmark, not a menu: links keep their roles and the browser's link behaviour.

## Without JavaScript, and the client script

The `<nav>`, its links and the triggers are HTML: each trigger opens its content with
`popovertarget`, one at a time (an auto popover closes the others), and Escape or a click outside
closes it. `value`, `onValueChange` and `bind:value` need the component to run in an island.

A page that renders a `NavigationMenu` loads a 2.1 kB (brotli) script, without the Lumiose runtime;
islands bundle it. `<lu-navigation-menu>` takes over the trigger's click (so a click keeps a content
opened by hover open), opens contents on hover, adds the arrow keys, closes a content when focus
leaves its item, keeps `aria-expanded` and `data-activation-direction` current, and places the
contents where CSS anchor positioning is missing.

## Browser support

- **Popovers and `popovertarget`**: every current browser.
- **CSS anchor positioning**: Chrome and Edge 125, Firefox 147, Safari 26. Elsewhere the script
  places the contents next to their triggers.
- **Exit animations** that keep a content in the top layer (`overlay`) are Chromium-only.

## Related

- [Menubar](menubar.md): a bar of application menus, with the menu roles.
- [Popover](popover.md): one popup anchored to its trigger.
- [UI components](README.md): the approach, styling and the other components.
