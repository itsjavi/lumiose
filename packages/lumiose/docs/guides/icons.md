# Icons with Lucide

> Use Lucide, or any SVG icon set, as inline components compiled at build time, sized and coloured with CSS.

[Lucide](https://lucide.dev) publishes every icon as an SVG file in the
[`lucide-static`](https://www.npmjs.com/package/lucide-static) package. Import a file with
`?component` and it becomes a Lumiose component, the same as an `.svg` file of your own (see
[SVG imports](../concepts/svg.md)): the build optimises and sanitises it, and the icon renders as
inline markup on the server, in the browser and in islands. Only the icons you import end up in
the build.

## Install

```sh
pnpm add -D lucide-static
```

A dev dependency is enough: the build inlines each imported icon, so neither the client nor the
server build loads `lucide-static` at runtime.

## Use an icon

The file name is the icon's name on lucide.dev, in kebab case: `icons/<name>.svg`.

```tsx
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

<style>
  .link { color: rebeccapurple; }
  .icon { width: 1.25em; height: 1.25em; stroke-width: 1.5; }
</style>
```

`lumiose/env` types every `*.svg?component` import, from packages too: the props are those of
`<svg>`, plus `title`.

## Size, colour and stroke

Lucide's files are 24 × 24, drawn with `stroke="currentColor"` and `stroke-width="2"` on the root
`<svg>`. Every one of these is a default that CSS or a prop replaces:

- **Size.** Set `width` and `height` in CSS, as `.icon` does above, or pass both props
  (`width={20} height={20}`). Sizing in `em` makes an icon follow the text around it.
- **Colour.** The stroke is `currentColor`, so the icon takes the `color` of its parent: the
  link's `rebeccapurple` above, and any `:hover` colour you give the link.
- **Stroke.** `stroke-width` in CSS or as a prop (`stroke-width={1.5}`). The paths inherit it from
  the root.

`class="icon"` receives the component's scope, so the scoped `.icon` rule applies to the icon's
root `<svg>`.

## Labels

An icon without `title`, `aria-label` or `aria-labelledby` is decorative and gets
`aria-hidden="true"`, which is right next to visible text (the "Home" link). An icon-only control
needs a name: `title="Search"` on the icon gives it a `<title>` with `role="img"`, or label the
control itself with `<button aria-label="Search">` and keep the icon decorative.

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
  replaces. Style your own class, as `.icon` above, rather than `.lucide`.
- **Setting only `width`.** The file's `height` of 24 stays and the drawing is centred in that box.
  Set both, in CSS or as props.
- **Labelling an icon next to its text.** A `title` there makes screen readers say the label
  twice. Leave such icons decorative.

See also: [SVG imports](../concepts/svg.md), [Styles](../concepts/styles.md), [Islands](../concepts/islands.md).
