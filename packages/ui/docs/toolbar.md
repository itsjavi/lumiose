# Toolbar

> A set of controls with one tab stop, after Base UI's Toolbar and the APG toolbar pattern: `<lu-toolbar role="toolbar">` moves focus between its items with the arrow keys, Home and End, following the orientation and the text direction. Its items are native: buttons that stay focusable when disabled, links, inputs, and the toggles of a [Toggle Group](toggle-group.md) inside it. In the server HTML every item is a tab stop, so each is reachable without JavaScript; a 1.0 kB script makes them one tab stop and moves it.

```ts
import { Toolbar } from "@lumiose/ui"; // or "@lumiose/ui/toolbar"
import "@lumiose/ui/toolbar.css"; // or "@lumiose/ui/styles.css" for every component
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Toolbar.Root>
  <Toolbar.Button />
  <Toolbar.Link />
  <Toolbar.Separator />
  <Toolbar.Group>
    <Toolbar.Button />
  </Toolbar.Group>
  <Toolbar.Input />
</Toolbar.Root>
```

| Part        | Renders                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------- |
| `Root`      | `<lu-toolbar role="toolbar" aria-orientation data-orientation>`                                    |
| `Button`    | A [Button](button.md): `<button type="button">`, `aria-disabled` when disabled (still focusable)   |
| `Link`      | `<a>`                                                                                              |
| `Input`     | `<input>`, `aria-disabled` and read-only when disabled (still focusable)                           |
| `Group`     | `<div role="group">`                                                                               |
| `Separator` | A [Separator](separator.md), `<hr>`, across the toolbar: vertical in a row, horizontal in a column |

Every item gets `data-orientation`; the script gives the tab stop `tabindex="0"` and the other
items `"-1"`. Name the toolbar with `aria-label` or `aria-labelledby`.

## API

### Toolbar.Root

| Prop          | Type                         | Default        |                                                                        |
| ------------- | ---------------------------- | -------------- | ---------------------------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | A row moved through with Left and Right, or a column with Up and Down. |
| `loopFocus`   | `boolean`                    | `true`         | The arrow keys go from the last item to the first, and back.           |
| `disabled`    | `boolean`                    | `false`        | Disables every item but links; they stay focusable.                    |

### Toolbar.Button, Toolbar.Input and Toolbar.Group

| Prop                    | Type      | Default |                                                                    |
| ----------------------- | --------- | ------- | ------------------------------------------------------------------ |
| `disabled`              | `boolean` | `false` | Disables the item (a Group: its items).                            |
| `focusableWhenDisabled` | `boolean` | `true`  | Button and Input: disabled, they stay focusable (`aria-disabled`). |

Every other native prop passes through. A `ToggleGroup` inside a toolbar keeps pressing its
toggles but leaves the arrow keys and the tab stop to the toolbar; a Menu or Popover trigger inside
it is an item too. A disabled Root or Group reaches them: its toggles and triggers render
`aria-disabled="true"` and stay focusable, but press and open nothing, without JavaScript too (the
triggers lose `popovertarget`). A Menu in a vertical toolbar opens beside it, at its inline end, as
in a vertical [Menubar](menubar.md). What a Menu's or a Popover's popup holds is not the toolbar's:
its toggles and triggers keep their own tab stops.

**Differences from Base UI's Toolbar.** No `render` or `nativeButton`: put other triggers
(`Menu.Trigger`, `Popover.Trigger`) in the toolbar directly. Disabled items are `aria-disabled`
rather than `data-disabled` and `data-focusable`.

## Example

```tsx check
import { Toggle, ToggleGroup, Toolbar } from "@lumiose/ui";

export function FormattingToolbar() {
  return (
    <Toolbar.Root aria-label="Formatting" class="lu-toolbar">
      <ToggleGroup aria-label="Text style" multiple class="lu-toggle-group">
        <Toggle value="bold" class="lu-toggle">
          Bold
        </Toggle>
        <Toggle value="italic" class="lu-toggle">
          Italic
        </Toggle>
      </ToggleGroup>
      <Toolbar.Separator />
      <Toolbar.Button class="lu-button">Undo</Toolbar.Button>
      <Toolbar.Button class="lu-button" disabled>
        Redo
      </Toolbar.Button>
      <Toolbar.Link href="/help">Help</Toolbar.Link>
    </Toolbar.Root>
  );
}
```

## Styling

**With the default theme**, put `lu-toolbar` on `Root`: a bordered row (a column when vertical)
that wraps on narrow screens, groups in rows, separators as 1px lines across it, links as tall as
the buttons. Style the items with their own classes (`lu-button`, `lu-toggle`, `lu-input`).

**With your own CSS**, style the parts through `class`, `[data-orientation]`, `[role="group"]`,
`hr` and the items' `[aria-disabled="true"]` and `:focus-visible`.

`@lumiose/ui/toolbar.css` makes `<lu-toolbar>` a block box, as Base UI's `<div>`.

## Keyboard and focus

| Key                      | Does                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| Tab                      | Into the toolbar on the last focused item (at first, the first), and out of it.  |
| Arrow Right / Arrow Left | In a row: the next or previous item (swapped right to left), looping.            |
| Arrow Down / Arrow Up    | In a column: the next or previous item, looping.                                 |
| Home / End               | The first or last item.                                                          |
| Enter / Space            | Acts on the item: presses a button or a toggle, follows a link.                  |
| Arrow Right              | In a column, on a Menu's trigger: opens the menu beside it (Left right to left). |

Natively disabled controls are skipped. When the item with the tab stop is removed, disabled or
hidden, the first item takes it. A key an item handles itself (a Menu trigger's) moves nothing. A
control keeps the keys it needs: a text field its
caret's Left and Right (focus moves on at its start or end) and Home and End, a number field or a
slider its arrows, a select Up and Down. Base UI advises at most one input, last.

## Without JavaScript, and the element's script

The server HTML is a labelled toolbar whose items are all tab stops, so Tab reaches each one
without JavaScript or before the script runs. `<lu-toolbar>`'s script (1.0 kB brotli with Button's)
makes the toolbar one tab stop, moves focus with the keys and keeps the tab stop on the last focused
item.

## Browser support

Custom elements and `role="toolbar"`: every supported browser and screen reader.

## Related

- [Toggle Group](toggle-group.md): toggles that share a value, in or out of a toolbar.
- [Button](button.md): the items' button, focusable when disabled.
- [Separator](separator.md): the line between groups.
- [Menu](menu.md): a menu opened from a toolbar button.
