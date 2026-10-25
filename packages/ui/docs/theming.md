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

| Class                | On                                             | Variants                                                                                    |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `lu-button`          | `Button`, any `<button>` part                  | `data-variant="primary"`, `data-variant="destructive"`                                      |
| `lu-dialog`          | `Dialog.Popup`                                 | Styles the backdrop, the title, the description and a `<footer>` inside                     |
| `lu-popover`         | `Popover.Popup`                                | Styles the title, the description and a `<footer>` inside                                   |
| `lu-tooltip`         | `Tooltip.Popup`                                |                                                                                             |
| `lu-tabs`            | `Tabs.Root`                                    | Styles the list, the tabs (the selected one underlined) and the panels                      |
| `lu-menu`            | every `Menu.Popup`                             | Styles the items, their checkbox and radio marks, separators and labels                     |
| `lu-combobox`        | `Combobox.Root`, `Autocomplete.Root`           | Lays out the field (label, chips, input, buttons) and styles the popup                      |
| `lu-select`          | `Select.Root`                                  | Makes it a customizable select and styles the control and the picker                        |
| `lu-field`           | `Field.Root`                                   | Stacks the label, control, description and errors; errors in red                            |
| `lu-input`           | `Input`, `Field.Control`                       | A text field with a focus ring and a red border when invalid                                |
| `lu-fieldset`        | `Fieldset.Root`, `CheckboxGroup`, `RadioGroup` | The legend and the items in a column                                                        |
| `lu-checkbox`        | `Checkbox.Root`                                | An 18px box in a 24px target, a ✓ or a dash                                                 |
| `lu-radio`           | `Radio.Root`                                   | An 18px circle in a 24px target, a thick ring when checked                                  |
| `lu-switch`          | `Switch.Root`                                  | A track and a thumb on the side that tells on from off                                      |
| `lu-collapsible`     | `Collapsible.Root`                             | Styles the trigger (a chevron) and animates the panel's height                              |
| `lu-accordion`       | `Accordion.Root`                               | Items between borders; styles the triggers and animates the panels                          |
| `lu-toast-viewport`  | `Toast.Viewport`                               | A column at the window's bottom end                                                         |
| `lu-toast`           | every `Toast.Root`                             | Styles the title, description and close button; `data-type="error"`                         |
| `lu-toggle`          | `Toggle`                                       | Pressed: a filled surface and a bar along the bottom                                        |
| `lu-toggle-group`    | `ToggleGroup`                                  | The toggles in a row, or a column when vertical                                             |
| `lu-progress`        | `Progress.Root`                                | The label and value above a bar; a sliding segment when indeterminate                       |
| `lu-meter`           | `Meter.Root`                                   | The label and value above a bar                                                             |
| `lu-slider`          | `Slider.Root`                                  | The label and value above the track, the indicator and 24px thumbs                          |
| `lu-number-field`    | `NumberField.Root`                             | The label above one bordered group: the input between its buttons                           |
| `lu-otp-field`       | `OTPField.Root`                                | A box per character, the caret's box ringed while focused                                   |
| `lu-preview-card`    | `PreviewCard.Popup`                            | A surface like a popover's, with a fade                                                     |
| `lu-toolbar`         | `Toolbar.Root`                                 | A bordered row (or column), separators across it, links as tall as buttons                  |
| `lu-scroll-area`     | `ScrollArea.Root`                              | A bordered box; 10px scrollbars shown on hover, scroll or focus                             |
| `lu-drawer`          | `Drawer.Popup`                                 | A surface against its edge (a handle on a bottom sheet), title, description, footer; slides |
| `lu-separator`       | `Separator`                                    | A 1px line in `--lu-border`, horizontal or vertical                                         |
| `lu-avatar`          | `Avatar.Root`                                  | A 40px circle on a muted surface, the image covering it, the initials centred               |
| `lu-menubar`         | `Menubar`                                      | A bordered bar of the triggers, the open one filled; `lu-menu` on each popup                |
| `lu-navigation-menu` | `NavigationMenu.Root`                          | The list in a row, the current page underlined, contents as surfaces that slide in          |

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
follows the system. Set `color-scheme: light` (or `dark`) on `:root` or on any element, in CSS,
inline or from a script, to force one, in development and in production builds alike (Lumiose's
CSS target keeps `light-dark()` as written; an older `build.cssTarget` would lower it to colours
that follow the system only). Redefine a property outside layers to change it:

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

In forced colours (Windows' contrast themes), the browser drops shadows and gradients and paints
backgrounds in its own palette, which would erase the state a colour shows. The theme draws those
states again in system colours (`Highlight`, `HighlightText`, `ButtonText`, `Canvas`): a switch's
thumb and its on state, a pressed toggle, the selected tab's bar, progress and meter values, a
slider's range, the scroll thumb and the highlighted menu item. A pressed toggle's focus ring,
outside its `Highlight` fill, is `CanvasText`, the colour every contrast theme pairs with the page
(Firefox would draw it in the toggle's `HighlightText`). Do the same for the states your own CSS
draws with a colour, in a `@media (forced-colors: active)` block.

## Your own CSS

Style the parts through:

- **Class props.** Every part takes `class` (and `style`), like the element it renders.
- **State.** Components expose state the way the platform does, so selectors read it directly:
  `dialog[open]`, `:modal`, `::backdrop`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`,
  `[aria-selected]`. Where the platform has no such state, they set Base UI's state attributes:
  `data-highlighted` on the active option of a list, `data-side` and `data-align` on a placed
  popup, `data-orientation`, `data-starting-style` and `data-ending-style` while a popup animates,
  `data-swiping`, `data-indeterminate` and others. Each component's page lists its own.
- **Custom properties.** The values components measure or place, such as a panel's height, a
  toast's index in its stack or a popup's offset, are custom properties with the `--lu-` prefix.
  Base UI names them without a prefix, so its `--collapsible-panel-height` is
  `--lu-collapsible-panel-height` here and its `--scroll-area-thumb-height` is
  `--lu-scroll-area-thumb-height`.

Other `data-*` attributes on the rendered HTML, such as the markers scripts use to find a part or
the settings the server HTML passes to a script, are internal and may change between versions.
Style those parts through their class props.

Each component's page has an example stylesheet to start from.

## Related

- [UI components](README.md): the approach and the components.
- [Installation](installation.md): adding the package and importing its stylesheets.
- [Styles](https://lumiose.dev/docs/concepts/styles/): scoped CSS and global stylesheets in Lumiose.
