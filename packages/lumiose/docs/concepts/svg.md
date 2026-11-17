# SVG imports

> Import any SVG file, from your project or an icon set, as an inline component with `?component`, optimised at build time and styled with CSS.

## Concept

### An icon is a component

With `?component`, an `.svg` import is a component, from your files or from a package
(`"lucide-static/icons/house.svg?component"`, see [Icons with Lucide](../guides/icons.md)). The
icon is inline: its paths are part of the page's HTML, CSS reaches them, and nothing is fetched.
Without the query, the import is Vite's asset URL.

```tsx
// src/components/Nav.stsx
import Home from "../icons/home.svg?component";
import logoUrl from "../icons/logo.svg";

export function Nav() {
  return (
    <nav>
      <img src={logoUrl} alt="Acme" width={96} height={24} />
      <a href="/" class="link">
        <Home class="icon" /> Home
      </a>
    </nav>
  );
}

<style>
  .link { color: rebeccapurple; }
  .icon { width: 1.25em; height: 1.25em; }
  .link:hover .icon { color: crimson; }
</style>
```

> **Details:** `class` on an icon receives the file's scope, so the scoped `.icon` rule applies.
> The build optimises the file with [SVGO](https://svgo.dev) and compiles it into a
> static template. The other queries (`?url`, `?inline`, `?raw`) and why icons are inline, not
> sprites: [SVG imports in depth](../reference/vite.md#svg-imports-in-depth).

### Props override the file

The file's root attributes (`width`, `height`, `viewBox`, `fill`, `stroke`, `class`) are
defaults: any `<svg>` prop you pass replaces the matching one. Icons drawn with `currentColor`
follow the text colour.

```tsx
import Star from "../icons/star.svg?component";

export function Rating(props: { value: number }) {
  return (
    <p style={{ color: "goldenrod" }}>
      <Star width={32} height={32} stroke-width={1.5} />
      {props.value}
    </p>
  );
}
```

> **Colour:** for a set with hard-coded colours, `lumiose({ svg: { currentColor: true } })`
> replaces every colour with `currentColor`.

### Labels

Without `title`, `aria-label` or `aria-labelledby`, an icon is decorative and gets
`aria-hidden="true"`. An icon-only control needs a `title`: it renders `<title>` as the first
child, with `role="img"` and `aria-labelledby` pointing at it.

```tsx
import Search from "../icons/search.svg?component";

export function SearchButton() {
  return (
    <button type="button">
      <Search class="icon" title="Search" />
    </button>
  );
}
```

### Icon files are untrusted input

The build keeps an allowlist of SVG elements and attributes, whatever the SVGO config: no
scripts, handlers, `<foreignObject>` HTML or `javascript:` URLs, and nothing that loads from
outside the file. Ids get a per-file prefix, so icons never clash. The full lists:
[SVG imports in depth](../reference/vite.md#svg-imports-in-depth).

## API

| Import / option                             | Gives                                                       |
| ------------------------------------------- | ----------------------------------------------------------- |
| `import Icon from "./icon.svg?component"`   | `(props: JSX.SVGProps<SVGSVGElement> & { title?: string })` |
| `import Icon from "pkg/icon.svg?component"` | The same, from a package                                    |
| `import url from "./icon.svg"`              | The asset URL (`string`, Vite; typed by `vite/client`)      |
| `import url from "./icon.svg?url"`          | The asset URL (`string`, Vite)                              |
| `import data from "./icon.svg?inline"`      | A `data:` URL (`string`, Vite; typed by `vite/client`)      |
| `import text from "./icon.svg?raw"`         | The file's text (`string`, Vite)                            |
| `lumiose({ svg: { optimize: config } })`    | Optimise with your SVGO config instead of Lumiose's         |
| `lumiose({ svg: { optimize: false } })`     | Skip SVGO (sanitising and id prefixes still run)            |
| `lumiose({ svg: { currentColor: true } })`  | Replace every colour with `currentColor`                    |
| `lumiose({ svg: false })`                   | `.svg` imports stay Vite's URLs                             |

The types come with `lumiose/env` (`"types": ["lumiose/env"]` in `tsconfig.json`).

## Example

Your own SVGO plugins (optional). By default SVGO runs `preset-default` plus
`convertStyleToAttrs`.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import lumiose from "@lumiose/vite";

export default defineConfig({
  plugins: [
    lumiose({
      svg: {
        optimize: {
          multipass: true,
          plugins: ["preset-default", "removeDimensions"],
        },
      },
    }),
  ],
});
```

## Common mistakes

- **Forgetting `?component`.** `import Icon from "./icon.svg"` is a URL string, and `?inline` a
  `data:` URL: `<Icon />` is a type error.
- **Styling inner paths from a scoped block.** Only the root `<svg>` carries your scope: use
  inherited properties (`color`, `fill`, `stroke`) or `:deep(path)`.
- **Setting only `width`.** The file's `height` stays. Pass both, or size icons with CSS.
- **Labelling a decorative icon.** Next to visible text, a `title` makes screen readers repeat it.
- **Icons that stay black.** The files hard-code a colour: use `svg: { currentColor: true }`.
- **Expecting `<foreignObject>` content.** HTML inside an icon is dropped.
- **Removing `viewBox` in a custom SVGO config.** The icon no longer scales.

The long forms: [Common mistakes with SVG imports](../reference/vite.md#common-mistakes-with-svg-imports).

## Related diagnostics

A file that is not well-formed SVG fails the build with its location
(`icon.svg: invalid SVG: … at 3:12`), as does a file whose root element is not `<svg>` and one
whose elements nest more than 128 levels deep.

See also: [Styles](styles.md), [JSX](jsx.md), [reference: `@lumiose/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
