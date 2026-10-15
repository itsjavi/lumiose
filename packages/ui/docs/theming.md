# Theming

> `@lumiose/ui` is unstyled: its stylesheets hold only what the components need to work. The optional default theme gives them a look, light and dark, through `--lu-` custom properties you can change; or style the parts with your own CSS.

## Cascade layers

The components' stylesheets hold only what a component needs to work (display, positioning and
anchoring, the top layer, the CSS variables a component sets), in the `lu.core` cascade layer. The
default theme sits in `lu.theme`, above it:

```ts
import "@lumiose/ui/styles.css"; // what every component needs (or "@lumiose/ui/dialog.css", …)
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

Both stylesheets declare the layers `lu.core, lu.theme`, in that order. CSS outside layers always
wins over layered CSS, so your own stylesheets override the package's without specificity games.
If your app orders its own layers, put `lu` first: `@layer lu, reset, components;`.

## The default theme

`@lumiose/ui/themes/default.css` is a ready look for demos, prototypes and getting started: neutral
surfaces, a blue primary, light and dark. It styles a few classes, which you put on the parts
through their `class` prop:

| Class         | On                  | Variants                                                                |
| ------------- | ------------------- | ----------------------------------------------------------------------- |
| `lu-button`   | any `<button>` part | `data-variant="primary"`, `data-variant="destructive"`                  |
| `lu-dialog`   | `Dialog.Popup`      | Styles the backdrop, the title, the description and a `<footer>` inside |
| `lu-popover`  | `Popover.Popup`     | Styles the title, the description and a `<footer>` inside               |
| `lu-tooltip`  | `Tooltip.Popup`     |                                                                         |
| `lu-tabs`     | `Tabs.Root`         | Styles the list, the tabs (the selected one underlined) and the panels  |
| `lu-menu`     | every `Menu.Popup`  | Styles the items, their checkbox and radio marks, separators and labels |
| `lu-combobox` | `Combobox.Root`     | Lays out the field (label, chips, input, buttons) and styles the popup  |
| `lu-select`   | `Select.Root`       | Makes it a customizable select and styles the control and the picker    |

Its colours and radius are custom properties with shadcn/ui's names and a `--lu-` prefix, so a
shadcn palette carries over:

| Property                                          | Used for                            |
| ------------------------------------------------- | ----------------------------------- |
| `--lu-background`, `--lu-foreground`              | Page-level surfaces and text        |
| `--lu-card`, `--lu-card-foreground`               | Cards                               |
| `--lu-popover`, `--lu-popover-foreground`         | Dialogs, popovers, menus            |
| `--lu-primary`, `--lu-primary-foreground`         | Primary actions                     |
| `--lu-secondary`, `--lu-secondary-foreground`     | Secondary actions                   |
| `--lu-muted`, `--lu-muted-foreground`             | Subdued surfaces and text           |
| `--lu-accent`, `--lu-accent-foreground`           | Hover and highlighted items         |
| `--lu-destructive`, `--lu-destructive-foreground` | Destructive actions                 |
| `--lu-border`, `--lu-input`, `--lu-ring`          | Borders, field borders, focus rings |
| `--lu-radius`                                     | Corner radius                       |

The theme sets `color-scheme: light dark` on `:root` and every colour with `light-dark()`, so it
follows the system. Set `color-scheme: light` (or `dark`) on `:root` or on any element to force
one, and redefine a property outside layers to change it:

```css
:root {
  --lu-primary: #7c3aed;
  --lu-radius: 0.375rem;
}
```

The theme meets WCAG 2.2 AA in light and dark: each `-foreground` colour reaches 4.5:1 on its
surface, and `--lu-input` (the borders of fields and controls) and `--lu-ring` (the focus ring)
reach 3:1 on the surfaces they sit on. `--lu-border` is for decoration, such as a dialog's edge:
it is too light to outline a control. Keep those ratios when you change the colours.

## Your own CSS

Style the parts through:

- **Class props.** Every part takes `class` (and `style`), like the element it renders. No part
  carries a class or attribute of its own.
- **State.** Components expose state the way the platform does, so selectors read it directly:
  `dialog[open]`, `:modal`, `::backdrop`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`,
  `[aria-selected]`, and `data-highlighted` on the active option of a list.

Each component's page has an example stylesheet to start from.

## Related

- [UI components](README.md): the approach and the components.
- [Installation](installation.md): adding the package and importing its stylesheets.
- [Styles](https://itsjavi.com/lumiose/docs/concepts/styles/): scoped CSS and global stylesheets in Lumiose.
