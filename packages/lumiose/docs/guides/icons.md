# Icons with Lucide

> Use Lucide, or any SVG icon set, as inline components compiled at build time, sized and coloured with CSS.

## 1. Install

```sh
pnpm add -D lucide-static
```

[Lucide](https://lucide.dev) publishes every icon as an SVG file in
[`lucide-static`](https://www.npmjs.com/package/lucide-static). A dev dependency is enough: the
build inlines each imported icon, so neither the client nor the server build loads the package at
runtime.

## 2. Import an icon

Import `icons/<name>.svg` with `?component`: the name is the icon's on lucide.dev, in kebab case.
The file becomes a Lumiose component, like an `.svg` file of your own
([SVG imports](../concepts/svg.md)).

```stsx
// src/components/Nav.stsx
import House from "lucide-static/icons/house.svg?component";
import Search from "lucide-static/icons/search.svg?component";

export function Nav() {
  return (
    <nav>
      <a href="/" class="link">
        <House class="icon" /> Home
      </a>
      <button type="button" class="link">
        <Search class="icon" title="Search" />
      </button>
    </nav>
  );
}
```

> **Details:** the build optimises and sanitises each icon and renders it as inline markup, on
> the server, in the browser and in islands. Only imported icons end up in the build.
> `lumiose/env` types the imports, from packages too: `<svg>`'s props, plus `title`.

## 3. Size and colour

Add a style block to the file. `class="icon"` receives the component's scope, so the scoped
`.icon` rule applies to the icon's root `<svg>`.

```stsx
<style>
  .link { color: rebeccapurple; }
  .icon {
    width: 1.25em;
    height: 1.25em;
    stroke-width: 1.5;
  }
</style>
```

Lucide's files are 24 × 24, with `stroke="currentColor"` and `stroke-width="2"` on the root
`<svg>`, which the paths inherit. Each is a default that CSS or a prop replaces
(`width={20} height={20}`, `stroke-width={1.5}`). Sizes in `em` follow the text around the icon,
and the stroke takes the `color` of its parent: the link's `rebeccapurple`, and any `:hover`
colour you give the link.

## 4. Label icon-only controls

```stsx
<button type="button" aria-label="Search">
  <Search class="icon" />
</button>
```

An icon without `title`, `aria-label` or `aria-labelledby` is decorative and gets
`aria-hidden="true"`, which is right next to visible text (the "Home" link). An icon-only control
needs a name: label the control itself, as here, or pass `title="Search"` to the icon, which gives
it a `<title>` with `role="img"`.

## Other icon sets

Any package that ships its icons as SVG files works the same way: import the file's path with
`?component`. Monochrome sets drawn with `currentColor` follow `color` as Lucide does. For a set
whose files hard-code a colour (`fill="#000"`), set `lumiose({ svg: { currentColor: true } })` in
`vite.config.ts`, which replaces every colour in `?component` imports with `currentColor`.

## Why not lucide-react or lucide

- **`lucide-react`** (and the other framework packages) export React components. Lumiose's JSX is
  not React's, so they do not render in Lumiose.
- **`lucide`**, the vanilla package, builds the icons in the browser at runtime from JavaScript
  icon data. A `?component` import does that work at build time instead: the server renders the
  icon, and the client ships no icon code beyond the markup it clones.

## Common mistakes

- **Forgetting `?component`.** `import House from "lucide-static/icons/house.svg"` is Vite's URL
  string, so `<House />` is a type error. Add `?component`.
- **Styling Lucide's classes.** The files carry `class="lucide lucide-house"`, which a `class` prop
  replaces. Style your own class, such as `.icon`, rather than `.lucide`.
- **Setting only `width`.** The file's `height` of 24 stays and the drawing is centred in that box.
  Set both, in CSS or as props.
- **Labelling an icon next to its text.** A `title` there makes screen readers say the label
  twice. Leave such icons decorative.

See also: [SVG imports](../concepts/svg.md), [Styles](../concepts/styles.md), [Islands](../concepts/islands.md).
