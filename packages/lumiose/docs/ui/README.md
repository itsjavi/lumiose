# UI components

> `@lumiose/ui`: accessible, unstyled UI primitives built on native elements (`<dialog>`, popover, invoker commands, CSS anchor positioning), server-rendered without hydration. You style them with your own CSS.

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
- **Parts.** Each component is a set of parts named as in Base UI (`Dialog.Root`,
  `Dialog.Trigger`, `Dialog.Popup`, …). Every part that renders an element takes that element's
  props (`class`, `style`, `aria-*`, events) and passes them through.
- **Signals.** A component's state is a prop and a callback: `open` with `onOpenChange`, `checked`
  with `onCheckedChange`, `value` with `onValueChange`. Pass a signal's value and write it back in
  the callback to keep both in sync, or leave both out and the element keeps its own state. Custom
  elements report changes with lowercase DOM events, like native ones: `openchange`,
  `checkedchange` and `change`.
- **Keyboard contracts.** Every component follows its WAI-ARIA Authoring Practices pattern, and
  its end-to-end tests check the keyboard paths and run axe.

This is the approach of [Timeless](https://timeless.build), ported to Lumiose.

## Styling

`@lumiose/ui` is **unstyled**: no theme and no design tokens. Its stylesheets hold only what a
component needs to work (display, positioning and anchoring, the top layer, the CSS variables a
component sets), all in one cascade layer, `lu`:

```ts
import "@lumiose/ui/styles.css"; // what every component needs

// or only what a page uses:
import "@lumiose/ui/dialog.css";
```

CSS outside layers always wins over layered CSS, so your own stylesheets override the package's
without specificity games. If your app orders its own layers, put `lu` first:
`@layer lu, reset, components;`.

Style the parts through:

- **Class props.** Every part takes `class` (and `style`), like the element it renders. No part
  carries a class or attribute of its own.
- **State.** Components expose state the way the platform does, so selectors read it directly:
  `dialog[open]`, `:modal`, `::backdrop`, `:popover-open`, `[aria-expanded]`, `[aria-checked]`,
  `[aria-selected]`, and `data-highlighted` on the active option of a list.

Each component's page has an example stylesheet to start from.

## Components

| Component            | Status  |
| -------------------- | ------- |
| Dialog, alert dialog | Planned |
| Popover, tooltip     | Planned |
| Menu                 | Planned |
| Combobox, select     | Planned |
| Tabs                 | Planned |

## Size

`@lumiose/ui` is opt-in, so its size is reported apart from the runtime's caps:
`pnpm --filter @lumiose/ui size` prints, per component, the JavaScript a server-rendered page loads
for its custom elements, the JavaScript an island that uses it loads, and its CSS (minified, gzip
and brotli).

## Related

- [Web components](../guides/web-components.md): custom elements in Lumiose pages and islands.
- [Islands](../concepts/islands.md): where components run in the browser.
- [JSX](../concepts/jsx.md): `class`, events and `on:`.
