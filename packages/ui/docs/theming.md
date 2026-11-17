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

`@lumiose/ui/themes/default.css` is a ready look with no opinions, for demos, prototypes and getting
started: black, white and greys, square corners, no shadows, light and dark. A dialog, a menu or
any other layer is told from the page by an edge in its text colour. A state is a shape or an
inversion, not a hue: a highlighted menu item swaps text and background, an invalid field has an
edge twice as thick, the selected tab and a pressed toggle have a bar. One colour, `--lu-accent`,
is yours to set ([The accent](#the-accent)).

It styles a few classes, which you put on the parts through their `class` prop:

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
| `lu-field`           | `Field.Root`                                   | Stacks the label, control, description and errors; errors in a medium weight                |
| `lu-input`           | `Input`, `Field.Control`                       | A text field with a focus ring and an edge twice as thick when invalid                      |
| `lu-fieldset`        | `Fieldset.Root`, `CheckboxGroup`, `RadioGroup` | The legend and the items in a column                                                        |
| `lu-checkbox`        | `Checkbox.Root`                                | An 18px box in a 24px target, a ✓ or a dash                                                 |
| `lu-radio`           | `Radio.Root`                                   | An 18px circle in a 24px target, a thick ring when checked                                  |
| `lu-switch`          | `Switch.Root`                                  | A square track, filled when on, and a thumb on the side that tells on from off              |
| `lu-collapsible`     | `Collapsible.Root`                             | Styles the trigger (a chevron) and animates the panel's height                              |
| `lu-accordion`       | `Accordion.Root`                               | Items between borders; styles the triggers and animates the panels                          |
| `lu-toast-viewport`  | `Toast.Viewport`                               | A column at the window's bottom end                                                         |
| `lu-toast`           | every `Toast.Root`                             | Styles the title, description and close button; `data-type="error"`                         |
| `lu-toggle`          | `Toggle`                                       | Pressed: a grey surface and a bar along the bottom                                          |
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
| `lu-avatar`          | `Avatar.Root`                                  | A 40px square on a muted surface, the image covering it, the initials centred               |
| `lu-menubar`         | `Menubar`                                      | A bordered bar of the triggers, the open one filled; `lu-menu` on each popup                |
| `lu-navigation-menu` | `NavigationMenu.Root`                          | The list in a row, the current page underlined and marked, contents as surfaces that slide  |

Its colours and radius are custom properties with shadcn/ui's names and a `--lu-` prefix:

| Property                                          | Used for                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--lu-background`, `--lu-foreground`              | Page-level surfaces and text: white and black, black and white in dark               |
| `--lu-card`, `--lu-card-foreground`               | Cards                                                                                |
| `--lu-popover`, `--lu-popover-foreground`         | Dialogs, popovers, menus, and the edge that tells them from the page                 |
| `--lu-primary`, `--lu-primary-foreground`         | Primary actions and inverted states (highlighted, pressed, checked): the text colour |
| `--lu-secondary`, `--lu-secondary-foreground`     | Secondary surfaces, such as a combobox's chips                                       |
| `--lu-muted`, `--lu-muted-foreground`             | Hover and subdued surfaces, secondary text (`#595959`, `#a3a3a3` in dark)            |
| `--lu-accent`, `--lu-accent-foreground`           | The one colour, for decoration (`#f5a300`, `#ffd27a` in dark), and text on it        |
| `--lu-destructive`, `--lu-destructive-foreground` | Destructive actions, errors and invalid edges: the text colour by default            |
| `--lu-border`, `--lu-input`, `--lu-ring`          | Hairlines, the edges of fields and controls, focus rings                             |
| `--lu-radius`                                     | Corner radius: `0` by default                                                        |

The theme sets `color-scheme: light dark` on `:root` and every colour with `light-dark()`, so it
follows the system. Set `color-scheme: light` (or `dark`) on `:root` or on any element, in CSS,
inline or from a script, to force one, in development and in production builds alike (Lumiose's
CSS target keeps `light-dark()` as written; an older `build.cssTarget` would lower it to colours
that follow the system only). Redefine a property outside layers to change it:

```css
:root {
  --lu-primary: #7c3aed;
  --lu-primary-foreground: #fff;
  --lu-ring: light-dark(#7c3aed, #a78bfa);
  --lu-destructive: light-dark(#dc2626, #f87171);
  --lu-destructive-foreground: light-dark(#fff, #000);
  --lu-radius: 0.375rem;
}
```

A shadcn/ui palette carries over under the same names, with one difference: `--lu-accent` is the
decorative colour here, and hover surfaces use `--lu-muted`. Shadows are yours to add, on the
classes above, outside layers.

### The accent

`--lu-accent` is the only colour in the theme: amber, `#f5a300` in light and `#ffd27a` in dark. It
is a decoration. The theme uses it for one thing, the small square before the current page of a
navigation menu, which the underline beside it does not depend on. Use it for your own marks:

```css
:root {
  --lu-accent: light-dark(#0f766e, #5eead4);
}
```

Never rely on it: it is not a text colour, a control's edge or a focus ring. The light amber is
2:1 on white, below the 3:1 a boundary needs and the 4.5:1 text needs. Text on an accent surface
uses `--lu-accent-foreground` (black, 10:1 on the light amber and 14.7:1 on the dark one).

### Contrast

The theme meets WCAG 2.2 AA in light and dark, in every state:

| Pair                                                       | Light  | Dark   | Needs |
| ---------------------------------------------------------- | ------ | ------ | ----- |
| Text on the page                                           | 21:1   | 21:1   | 4.5:1 |
| Control edges (`--lu-input`) and focus rings (`--lu-ring`) | 21:1   | 21:1   | 3:1   |
| Text and rings on a hovered surface (`--lu-muted`)         | 18.4:1 | 17.4:1 | 4.5:1 |
| Text on a pressed button (`--lu-border`)                   | 16.2:1 | 15.1:1 | 4.5:1 |
| A filled button's text, hovered                            | 15.1:1 | 14.8:1 | 4.5:1 |
| A filled button's text, pressed                            | 8.5:1  | 10:1   | 4.5:1 |
| Secondary text (`--lu-muted-foreground`) on the page       | 7:1    | 8.3:1  | 4.5:1 |
| Secondary text on `--lu-muted` (an avatar's initials)      | 6.1:1  | 6.9:1  | 4.5:1 |
| The scroll thumb on the page                               | 7:1    | 8.3:1  | 3:1   |

Focus rings are `--lu-ring`, the text colour. On an inverted item (a highlighted menu item or
option, the open menu of a menubar) the ring is drawn inside the item in `--lu-primary-foreground`,
21:1 against its fill. Disabled controls are dimmed; WCAG asks no contrast of them. `--lu-border`
is for decoration, such as a separator: it is too light to outline a control. Keep those ratios
when you change the colours.

### Changes in the black and white theme

The theme was neutral greys with a blue primary, red errors, rounded corners and shadows. What
changed:

- No property was renamed or removed. Their default values changed: `--lu-primary` and `--lu-ring`
  are the text colour (they were blue), `--lu-destructive` is the text colour (it was red),
  `--lu-input` is the text colour (it was a mid grey), and `--lu-radius` is `0` (it was `0.625rem`).
- `--lu-accent` changed meaning: it was the hover surface, a grey, and is now the decorative
  colour. Hover surfaces use `--lu-muted`. If you set `--lu-accent` to restyle hovers, set
  `--lu-muted` instead.
- Layers have no shadow, and their edge is `--lu-popover-foreground` (it was `--lu-border`).
- A highlighted menu item or option and the open menu of a menubar are inverted: the text colour
  as their background.
- Errors and invalid controls are not red: an error is full-strength text in a medium weight, and
  an invalid control has an edge twice as thick. A destructive button looks like a primary one.
- The switch, the slider's thumbs, the avatar, progress and meter bars and scroll thumbs are square.
  They follow `--lu-radius`; a radio stays round.

To get the previous colours and corners back, set the properties to their former values:

```css
:root {
  --lu-background: light-dark(#fff, #09090b);
  --lu-foreground: light-dark(#09090b, #fafafa);
  --lu-popover: light-dark(#fff, #18181b);
  --lu-popover-foreground: light-dark(#09090b, #fafafa);
  --lu-primary: #2563eb;
  --lu-primary-foreground: #fff;
  --lu-muted: light-dark(#f4f4f5, #27272a);
  --lu-muted-foreground: light-dark(#67676f, #a1a1aa);
  --lu-destructive: light-dark(#dc2626, #f87171);
  --lu-destructive-foreground: light-dark(#fff, #000);
  --lu-border: light-dark(#e4e4e7, #3f3f46);
  --lu-input: light-dark(#85858e, #71717a);
  --lu-ring: light-dark(#2563eb, #60a5fa);
  --lu-radius: 0.625rem;
}
```

The inversions, the square switch and the missing shadows stay: restyle those parts with your own
CSS.

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
