# UI components

> `@lumiose/ui`: accessible, unstyled UI primitives built on native elements (`<dialog>`, popover, invoker commands, CSS anchor positioning), server-rendered without hydration. Style them with your own CSS or the optional default theme.

**Status:** in development. `@lumiose/ui` keeps its own 0.x versions, apart from the version all
other Lumiose packages share, and is not on npm yet: today it is used from this repository's
workspace. The goal for its 1.0 is parity with [Base UI](https://base-ui.com)'s components; the
table below lists them as they land.

## Approach

- **Native first.** A component renders the element the platform already has for the job: a
  `<dialog>` opened by an invoker command, a popover, a `<button>`. Those work in server HTML
  before any script loads, and keep the browser's own keyboard handling and focus management.
- **Custom elements only where the platform falls short.** Keyboard navigation in a menu or the
  filtering of a combobox need script: those components render a light-DOM custom element with a
  `lu-` tag (`lu-menu`, `lu-combobox`) that upgrades the server HTML in place. A page is meant to
  load only the definitions of the elements it renders, and no island runtime for them (in
  development, with those components).
- **Small scripts for native gaps.** Where a native element falls short of Base UI's behaviour, a
  small script closes the gap, such as Dialog's right-click and touch handling. The component
  still works without it; a page that renders the component loads it once, without the island
  runtime.
- **Parts.** Each component is a set of parts named as in Base UI (`Dialog.Root`,
  `Dialog.Trigger`, `Dialog.Popup`, …). Every part that renders an element takes that element's
  props (`class`, `style`, `aria-*`, events) and passes them through.
- **Signals.** A component's state is a prop and a callback: `open` with `onOpenChange`, `checked`
  with `onCheckedChange`, `value` with `onValueChange`. Pass a signal's value and write it back in
  the callback to keep both in sync, or leave both out and the element keeps its own state. Custom
  elements report changes with lowercase DOM events, like native ones: `openchange`,
  `checkedchange` and `change`.
- **Keyboard contracts.** Every component follows its WAI-ARIA Authoring Practices pattern, and
  its end-to-end tests check the keyboard paths.
- **WCAG 2.2 AA.** Every component meets it: the components own semantics, keyboard and
  behaviour, and the default theme owns the visual criteria (contrast, non-text contrast, focus
  visible, target size). Each component's end-to-end tests run axe with the WCAG A and AA rules,
  closed and open, in light and dark, and check reflow at 320 CSS pixels and text spacing.

This is the approach of [Timeless](https://timeless.build), ported to Lumiose.

## Styling

`@lumiose/ui` is **unstyled**: its stylesheets hold only what a component needs to work
(display, positioning and anchoring, the top layer, the CSS variables a component sets), in the
`lu.core` cascade layer. A look is opt-in: the default theme, or your own CSS.

```ts
import "@lumiose/ui/styles.css"; // what every component needs (or "@lumiose/ui/dialog.css", …)
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

Both stylesheets declare the layers `lu.core, lu.theme`, in that order. CSS outside layers always
wins over layered CSS, so your own stylesheets override the package's without specificity games.
If your app orders its own layers, put `lu` first: `@layer lu, reset, components;`.

### The default theme

`@lumiose/ui/themes/default.css` is a ready look for demos, prototypes and getting started: neutral
surfaces, a blue primary, light and dark. It styles a few classes, which you put on the parts
through their `class` prop:

| Class       | On                  | Variants                                                                |
| ----------- | ------------------- | ----------------------------------------------------------------------- |
| `lu-button` | any `<button>` part | `data-variant="primary"`, `data-variant="destructive"`                  |
| `lu-dialog` | `Dialog.Popup`      | Styles the backdrop, the title, the description and a `<footer>` inside |

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

### Your own CSS

Style the parts through:

- **Class props.** Every part takes `class` (and `style`), like the element it renders. No part
  carries a class or attribute of its own.
- **State.** Components expose state the way the platform does, so selectors read it directly:
  `dialog[open]`, `:modal`, `::backdrop`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`,
  `[aria-selected]`, and `data-highlighted` on the active option of a list.

Each component's page has an example stylesheet to start from.

## Components

| Component                         | Status                                                 |
| --------------------------------- | ------------------------------------------------------ |
| [Dialog, alert dialog](dialog.md) | Available: native `<dialog>`, works without JavaScript |
| Popover, tooltip                  | Planned                                                |
| Menu                              | Planned                                                |
| Combobox, select                  | Planned                                                |
| Tabs                              | Planned                                                |

## Size

`@lumiose/ui` is opt-in, so its size is reported apart from the runtime's caps:
`pnpm --filter @lumiose/ui size` prints, per component, the JavaScript a server-rendered page loads
for its custom elements, the JavaScript an island that uses it loads, and its CSS (minified, gzip
and brotli).

## Related

- [Web components](../guides/web-components.md): custom elements in Lumiose pages and islands.
- [Islands](../concepts/islands.md): where components run in the browser.
- [JSX](../concepts/jsx.md): `class`, events and `on:`.
