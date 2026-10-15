# Installation

> Add `@lumiose/ui` to a Lumiose app and import its stylesheets, and the default theme if you want its look. The components then render in server HTML, without an island, and a page loads only the small scripts of the components it renders.

**Status:** `@lumiose/ui` is not on npm yet. In this repository's workspace, an app adds it as
`"@lumiose/ui": "workspace:*"` in its `dependencies`.

## Add the package

`@lumiose/ui` needs a Lumiose app: it ships its components as TSX, which the app's build compiles
with the app's own code, and `lumiose` is its peer dependency. Once it is on npm:

```sh
pnpm add @lumiose/ui
```

A new app can start with it: `create-lumiose --ui` adds the dependency, imports the stylesheets in
the root layout and adds the UI agent files (the `lumiose-ui` skill and a UI part in `AGENTS.md`).
In an app that already depends on it, `lumiose agents init` adds those agent files.

## Import the stylesheets

Import them once, in the root layout (`src/routes/layout.stsx`), so every page has them:

```ts
import "@lumiose/ui/styles.css"; // what every component needs (or "@lumiose/ui/dialog.css", …)
import "@lumiose/ui/themes/default.css"; // optional: the default theme
```

They sit in cascade layers, so your own CSS overrides them without specificity games
([Theming](theming.md#cascade-layers)).

## Use a component

Import a component from `@lumiose/ui` (or its own entry, `@lumiose/ui/popover`) and compose its
parts. In a page or a server component it renders as server HTML that works before any script
loads; with the default theme, the `lu-` classes give it its look:

```tsx check
import { Popover } from "@lumiose/ui";

export function Help() {
  return (
    <Popover.Root>
      <Popover.Trigger class="lu-button">Help</Popover.Trigger>
      <Popover.Popup class="lu-popover">
        <Popover.Title>Help</Popover.Title>
        <Popover.Description>
          Server HTML: this popover opens without JavaScript.
        </Popover.Description>
      </Popover.Popup>
    </Popover.Root>
  );
}
```

To keep a component's state in a signal (`bind:open`, `bind:value`), render it inside an
[island](https://itsjavi.com/lumiose/docs/concepts/islands/). Each component's page lists its parts,
props, keyboard contract and what works without JavaScript.

## Related

- [UI components](README.md): the approach and the components.
- [Theming](theming.md): the default theme's classes and `--lu-` properties, and your own CSS.
- [Getting started](https://itsjavi.com/lumiose/docs/getting-started/): a new Lumiose app.
