# Stylesheets, CSS Modules and Tailwind

> Imported `.css` files, CSS Modules and Tailwind v4 next to `<style>` blocks: where each is linked, the cascade order, and why StyleX is not supported yet.

[Style blocks](../concepts/styles.md) hold a component's own styles. Three other ways to style work next to them through
Vite, in `lumiose dev` and in builds: imported `.css` files, CSS modules and Tailwind v4. A smoke
test (`examples/ssr-styles-e2e`) checks each one in Chromium: server-rendered, without
JavaScript, and in a hydrated island. StyleX is not supported yet ([below](#stylex)); Sass is not covered.

## Imported stylesheets

Imported `.css` files are global. Nothing in them is scoped, and `$` references are not read.
A page links a stylesheet when its import graph reaches it: the page, its layouts and the
components they import. Import a stylesheet from the root layout to link it on every page, or from
one route's page or layout to link it on that route only. The server-rendered HTML links it, so
the page is styled before any script runs; builds merge it with the page's other stylesheets ([Build output](../reference/styles.md#build-output)).

```stsx check
// src/routes/layout.stsx
// Global CSS first: the file's style block comes after it in the cascade.
import "../styles/app.css";

export default function Root(props: { children?: JSX.Element }) {
  return <div class="shell">{props.children}</div>;
}

<style>
  .shell { max-inline-size: 60rem; margin-inline: auto; }
</style>
```

## Cascade order

A page's stylesheets come in import order: a file's imports (stylesheets and
the components it renders) before its own style blocks, and a layout before its page. Rules of the
same specificity resolve in that order. A scoped selector carries an extra attribute (+0,1,0), so a
block's `.card` beats a stylesheet's `.card` wherever the two come. Keep base styles (resets,
typography, tokens) in a global stylesheet and refine them in blocks.

## CSS Modules

CSS Modules suit stylesheets shared by several files or brought from another project. Vite
processes `*.module.css` files: it hashes each class name (`.pill` becomes `_pill_1x2y3_1`), and
the default export maps the names to the hashed classes, typed as a read-only class map by
`lumiose/env`. The server render and the browser get the same names in `lumiose dev` and in builds,
so islands hydrate without mismatches. Pass the classes to `class` like any string, alone or in an
array with other classes:

```css
/* src/components/Badge.module.css */
.pill {
  border-radius: 999px;
  padding: 0 0.5rem;
}
.warn {
  background: gold;
}
```

```stsx check file=components/Badge.stsx
// src/components/Badge.stsx
import styles from "./Badge.module.css";

export function Badge(props: { warn?: boolean; class?: string; children?: JSX.Element }) {
  return (
    <span class={["badge", styles.pill, props.warn && styles.warn, props.class]}>
      {props.children}
    </span>
  );
}

<style>
  .badge { display: inline-flex; align-items: center; }
</style>
```

A CSS module is global CSS with unique names: placement scoping, `$name` constants and the
`LUM3xxx` diagnostics apply to style blocks only. Prefer a style block for a component's own
styles; class completion in the editor covers style blocks and global stylesheets, not CSS
modules. Other preprocessors' module files (`.module.scss`) work through Vite, typed by
`vite/client`.

## Tailwind v4

Install `tailwindcss` and `@tailwindcss/vite`, add Tailwind's Vite plugin next to
Lumiose's, and import Tailwind from a global stylesheet that the root layout imports (the
`src/styles/app.css` of the layout above):

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [tailwindcss(), lumiose()] });
```

```css
/* src/styles/app.css */
@import "tailwindcss";
```

Tailwind's scanner reads every source file Git does not ignore, `.stsx` files included, and
generates the utilities it finds. Write them in `class` as a string, an array or a record. As
Tailwind requires, each class appears whole in the source, also the ones a signal turns on later:

```stsx check file=components/Toggle.stsx
// src/components/Toggle.stsx
import { signal } from "lumiose";

export function Toggle(props: { label: string }) {
  const on = signal(false);

  return (
    <button
      type="button"
      class={[
        "rounded-lg px-3 py-1",
        { "font-bold": on(), underline: on() },
        on() ? "bg-emerald-500 text-white" : "bg-gray-200",
      ]}
      onClick={() => on.update((value) => !value)}
    >
      {props.label}
    </button>
  );
}
```

- **Utilities lose to style blocks.** Tailwind v4 puts utilities in `@layer utilities`. Style
  blocks and the unlayered rules of your stylesheets are in no layer, so they win at any
  specificity: `<p class="note p-8">` keeps a block's `.note { padding: 2px; }`. Set a property in
  one place, or make the utility important (`p-8!`).
- **In style blocks, read Tailwind's theme variables:** `color: var(--color-emerald-500)`,
  `padding: calc(var(--spacing) * 4)`. Tailwind emits the variables it finds in the sources.
- **`@apply`, `theme()` and `--spacing()`** work in a block that starts with
  `@reference "../styles/app.css";` (the stylesheet that imports Tailwind), as in any CSS that
  Tailwind processes on its own. Without it, the build fails with "Cannot apply unknown utility
  class". The block's selectors stay scoped: `.card { @apply p-6; }` styles only this file's
  `.card`.

  ```stsx
  <style>
    @reference "../styles/app.css";
    .card {
      @apply rounded-lg p-6 font-bold;
      margin: --spacing(4);
      border: 2px solid theme(--color-red-500);
    }
  </style>
  ```

  The compiler keeps Tailwind's at-rules as written for Tailwind's Vite plugin and does not report
  them: `@apply`, `@reference`, `@theme`, `@utility`, `@variant`, `@custom-variant` (with
  `@slot`), `@source`, `@plugin` and `@config`. Other unknown at-rules are still
  [LUM3015](../errors/LUM3015.md) warnings, and so is `@APPLY`: Tailwind matches the names
  case-sensitively.

- **In the editor,** Lumiose's class completion lists the classes of style blocks and global
  stylesheets, not Tailwind's utilities. Tailwind CSS IntelliSense for VS Code gives those once it
  treats `.stsx` like JSX, in the workspace settings:
  `"tailwindCSS.includeLanguages": { "stsx": "javascriptreact" }`.

## StyleX

StyleX is not supported yet in server-rendered apps (spiked with StyleX 0.19 and its Vite
plugin, `@stylexjs/unplugin`):

- **`.stsx` files are not compiled.** The plugin only transforms `.js`, `.ts`, `.jsx` and `.tsx`
  files, so `stylex.create()` in an `.stsx` file throws when the page renders. In `.ts` and `.tsx`
  modules it compiles.
- **Production builds lose rules.** The plugin appends all rules to one stylesheet (renamed under
  a new hash, which pages follow), while Lumiose links each route's own stylesheets: only the pages
  that link that one file get the rules. Pointing its `cssInjectionTarget` at a stylesheet the root
  layout imports stops the build in Vite (`vite:css-post`), since the plugin deletes a file Vite
  still reads.
- **In `lumiose dev`** the rules are served at `/virtual:stylex.css` but not linked; a document
  must link them itself: `{import.meta.env.DEV && <link rel="stylesheet" href="/virtual:stylex.css" />}`.
- **Apply styles with `stylex.attrs()`,** which returns `class` and a `style` string, the attributes
  Lumiose's JSX takes: `<h1 {...stylex.attrs(styles.title)}>`. `stylex.props()` returns React's
  `className` and a camelCase `style` object, which Lumiose does not read.

## Common mistakes

- **Expecting a Tailwind utility to override a style block.** Utilities are in a cascade layer,
  which loses to every style block. Set the property in one place, or make the utility important
  (`p-8!`).
- **`@apply` without `@reference`** fails the build ("Cannot apply unknown utility class"). Start
  the block with `@reference` to the stylesheet that imports Tailwind.
- **Tailwind classes built from pieces** (`` `bg-${color}-500` ``). Tailwind's scanner cannot find
  them; write every class whole, for example in a record (`{ "bg-red-500": error() }`).
- **`stylex.create()` in an `.stsx` file.** StyleX does not compile `.stsx` files and is not
  supported yet in server-rendered apps.

See also: [Styles](../concepts/styles.md), [Style blocks](../reference/styles.md), [`@lumiose/vite`](../reference/vite.md).
