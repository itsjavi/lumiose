# UI components

> `@lumiose/ui`: accessible, unstyled UI primitives built on native elements (`<dialog>`, popover, invoker commands, CSS anchor positioning), server-rendered without hydration. Style them with your own CSS or the optional default theme.

**Status:** in development. `@lumiose/ui` keeps its own 0.x versions, apart from the version all
other Lumiose packages share, and is not on npm yet: today it is used from this repository's
workspace. The goal for its 1.0 is parity with [Base UI](https://base-ui.com)'s components; the
table below lists them as they land.

These pages ship in the package, in `node_modules/@lumiose/ui/docs`, so they match the installed
version, and the Lumiose site renders them with a live demo of each example at
[itsjavi.com/lumiose/ui](https://itsjavi.com/lumiose/ui/). Start with [Installation](installation.md)
and [Theming](theming.md). For coding agents, `llms.txt` indexes them and `llms-full.txt` holds them all;
`lumiose docs ui` and `lumiose docs dialog` print them; the MCP server's `ui_components` tool lists
every component's parts, props, events and styling hooks; and `lumiose agents init` adds a UI
section to `AGENTS.md` and the `lumiose-ui` skill. Every component page has the same sections:
Anatomy, API, Example, Styling, Keyboard and focus, Without JavaScript, Browser support and Related.

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

`@lumiose/ui` is **unstyled**: its stylesheets hold only what a component needs to work (display,
positioning and anchoring, the top layer, the CSS variables a component sets), in the `lu.core`
cascade layer. A look is opt-in: the default theme, or your own CSS. [Installation](installation.md)
shows the imports, and [Theming](theming.md) the layers, the theme's classes and custom properties,
and how to style the parts yourself.

### The default theme

`@lumiose/ui/themes/default.css` is a ready look for demos, prototypes and getting started: neutral
surfaces, a blue primary, light and dark. Its classes (`lu-button`, `lu-dialog`, …) and its `--lu-`
custom properties, named as in shadcn/ui, are listed in [Theming](theming.md#the-default-theme).

## Components

| Component                           | Status                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| [Dialog, alert dialog](dialog.md)   | Available: native `<dialog>`, works without JavaScript                                    |
| [Popover](popover.md)               | Available: native popover, works without JavaScript                                       |
| [Tooltip](tooltip.md)               | Available: native hint popover, opened by its script                                      |
| [Menu](menu.md)                     | Available: popover menu, opens without JavaScript                                         |
| [Combobox](combobox.md)             | Available: `<lu-combobox>`, a form control that filters its options                       |
| [Select](select.md)                 | Available: native `<select>`, customizable where supported, no script                     |
| [Tabs](tabs.md)                     | Available: server HTML with the full state, `<lu-tabs>` adds the keys                     |
| [Field](field.md)                   | Available: label, description, errors; native validation in the field                     |
| [Fieldset](fieldset.md)             | Available: native `<fieldset>` and `<legend>`, no script                                  |
| [Form](form.md)                     | Available: native `<form>`, a form action's errors in its fields                          |
| [Input](input.md)                   | Available: native `<input>`, no script                                                    |
| [Checkbox](checkbox.md)             | Available: native checkbox, indeterminate and read-only                                   |
| [Checkbox Group](checkbox-group.md) | Available: checkboxes with one value and a parent checkbox                                |
| [Radio](radio-group.md)             | Available: native radios in a radiogroup fieldset                                         |
| [Switch](switch.md)                 | Available: native checkbox with the switch role                                           |
| [Collapsible](collapsible.md)       | Available: native `<details>`, works without JavaScript                                   |
| [Accordion](accordion.md)           | Available: native `<details>` items, `<lu-accordion>` adds the keys                       |
| [Toast](toast.md)                   | Available: server-rendered or from a manager, `<lu-toast-viewport>` times and closes them |
| [Context Menu](context-menu.md)     | Available: Menu at the pointer, opened by its script (right-click, long press, keys)      |
| [Drawer](drawer.md)                 | Available: a Dialog against an edge, works without JavaScript; its script adds the swipe  |

## Size

`@lumiose/ui` is opt-in, so its size is reported apart from the runtime's caps:
`pnpm --filter @lumiose/ui size` prints, per component, the JavaScript a server-rendered page loads
for its custom elements, the JavaScript an island that uses it loads, and its CSS (minified, gzip
and brotli).

## Related

- [Web components](https://itsjavi.com/lumiose/docs/guides/web-components/): custom elements in Lumiose pages and islands.
- [Islands](https://itsjavi.com/lumiose/docs/concepts/islands/): where components run in the browser.
- [JSX](https://itsjavi.com/lumiose/docs/concepts/jsx/): `class`, events and `on:`.
