# Separator

> A native `<hr>` between groups of content, after Base UI's Separator: announced as a separator, horizontal by default, or vertical between the items of a row with `aria-orientation="vertical"`. No script.

```ts
import { Separator } from "@lumiose/ui"; // or "@lumiose/ui/separator"
import "@lumiose/ui/separator.css"; // a vertical separator's margins and height in a row
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

## Anatomy

```tsx
<Separator />
```

| Part        | Renders                                                                              |
| ----------- | ------------------------------------------------------------------------------------ |
| `Separator` | `<hr data-orientation="…">`, with `aria-orientation="vertical"` when it is vertical. |

An `<hr>` is a separator for assistive technology with no role to add. It is flow content: it
cannot go inside a `<p>`, a `<span>` or a `<button>`, where the browser would move it out of the
element.

## API

### Separator

| Prop          | Type                         | Default        |                                                                           |
| ------------- | ---------------------------- | -------------- | ------------------------------------------------------------------------- |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Which way it runs: `"vertical"` between the items of a row (a toolbar's). |

Every other native prop passes through: `class`, `style`, `id`, `aria-*`, `data-*`.

**Differences from Base UI's Separator.** It is always an `<hr>`, not a `<div role="separator">`:
no `render`. A horizontal one leaves out `aria-orientation="horizontal"`, an `<hr>`'s default.

## Example

Links in a row, split into groups, styled by the default theme:

```tsx check
import { Separator } from "@lumiose/ui";

export function FooterLinks() {
  return (
    <nav aria-label="Footer" style={{ display: "flex", gap: "0.75rem", "align-items": "center" }}>
      <a href="#docs">Docs</a>
      <a href="#blog">Blog</a>
      <Separator orientation="vertical" class="lu-separator" />
      <a href="#privacy">Privacy</a>
      <a href="#terms">Terms</a>
    </nav>
  );
}
```

Between sections of a page or a card, a horizontal one:

```tsx check
import { Separator } from "@lumiose/ui";

export function AccountCard() {
  return (
    <section aria-label="Account">
      <p>Signed in as ada@example.com</p>
      <Separator class="lu-separator" />
      <p>Plan: Free</p>
    </section>
  );
}
```

## Styling

**With the default theme**, put `lu-separator` on it: a 1px line in `--lu-border`, with a margin
above and below when horizontal, and as tall as its row when vertical.

**With your own CSS**, style it through `class` and `[data-orientation]`. Reset the borders an
`<hr>` has by default, and draw the line with a background:

```css
.separator {
  border: 0;
  background: #e4e4e7;
}
.separator[data-orientation="horizontal"] {
  block-size: 1px;
  margin: 1rem 0;
}
.separator[data-orientation="vertical"] {
  inline-size: 1px;
}
```

`@lumiose/ui/separator.css`, in the `lu.core` layer, gives a vertical separator no margins (an
`<hr>`'s automatic ones would push the row's items apart) and the full height of its row, even one
that centres its items (`align-self: stretch`).

## Keyboard and focus

A separator takes no focus and has no keys: it only structures the content around it.

## Without JavaScript, and the client script

A native `<hr>` with attributes: it needs no script, on the server or in an island.

## Browser support

Native `<hr>` and `aria-orientation`: every browser.

## Related

- [Menu](menu.md): `Menu.Separator` between a menu's items.
- [Select](select.md): separators between a select's options.
- [UI components](README.md): the approach, styling and the other components.
