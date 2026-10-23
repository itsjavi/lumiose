# SVG imports

> Import any SVG file, from your project or an icon set, as an inline component with `?component`, optimised at build time and styled with CSS.

## Concept

With the Lumiose Vite plugin, an `.svg` file imported with `?component` is a component. The build
optimises the file with [SVGO](https://svgo.dev) and compiles it into a static template, so
rendering an icon clones markup, on the server and in the browser alike. The icon is
**inline**: its paths are part of the page's HTML, CSS reaches them, and nothing is fetched.

The query is the switch, so it works the same for your files and for packages:
`import House from "lucide-static/icons/house.svg?component"` (see
[Icons with Lucide](../guides/icons.md)). Without it, an `.svg` import is what Vite makes of it: a URL by default.

- **Props override the file.** The file's root attributes (`width`, `height`, `viewBox`, `fill`,
  `stroke`, `class`, …) are defaults; any `<svg>` prop you pass replaces the matching one:
  `class`, `style`, `width`, `height`, `fill`, `aria-*`, events and `ref`. The defaults other
  than `class` and `style` stay in the cloned template, so rendering an icon only sets the props
  you pass.
- **Colour.** Icons drawn with `currentColor` follow the text colour (`color` in CSS). For icons
  with a hard-coded colour, set `lumiose({ svg: { currentColor: true } })` to replace every colour
  with `currentColor`, or pass `fill`/`stroke` props.
- **Accessibility.** Without `title`, `aria-label` or `aria-labelledby`, an icon is decorative
  and gets `aria-hidden="true"`. `title="Home"` renders `<title>` as the first child, with
  `role="img"` and `aria-labelledby` pointing at it. The id comes from the file and the title
  text, so the server and the client agree without a counter. The file's own `<title>` is
  dropped: the prop is the label.
- **What the build keeps.** An allowlist, whatever the SVGO config, so an icon file can never
  run script or act as HTML on your page:
  - **Elements**: the SVG ones, spelled as SVG spells them (`linearGradient`, not
    `lineargradient`): `svg`, `g`, `defs`, `symbol`, `use`, `switch`, `a`, `style`, the shapes
    (`path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`), text (`text`, `tspan`,
    `textPath`), `image`, paint servers, `clipPath`, `mask`, `marker`, `filter` and every `fe*`
    primitive, and the SMIL animations `animate`, `animateMotion`, `animateTransform`, `set` and
    `mpath`. Anything else is dropped with its content: `<script>`, `<foreignObject>` (and the
    HTML in it), editor elements (`sodipodi:*`, `<rdf>`), unknown or invalid names.
  - **Attributes**: the SVG presentation, geometry, link, text, gradient, filter and animation
    attributes, `id`, `class`, `style`, `role`, `tabindex`, `aria-*` and `data-*`, as plain string
    attributes. Event handlers (`onload`), DOM properties (`innerHTML`) and attributes of other
    namespaces are dropped; so are `javascript:` URLs.
  - **Animations** that target a link (`href`), a handler (`on…`) or `style`, or whose
    `values`/`from`/`to`/`by` hold a `javascript:` URL in any item, are dropped. The check fails
    closed: every spelling of those attributes counts, in any letter case or namespace, so a
    second `attributename="fill"` cannot vouch for an `attributeName="href"`.
  - **`<style>` text** keeps its CSS, with `<` and `&` written as CSS escapes (`\3c `, `\26 `):
    in a page, an inline SVG's `<style>` is parsed as markup, where they could open a tag. Only
    its text (and CDATA) is CSS, as in a browser: XML comments and elements inside it go.
  - **References outside the file** are dropped, so an icon never makes the page load anything
    (decision-69): an `href` that is not a fragment (`#id`) on `<use>`, `<image>`, `<feImage>`
    or any element but a link `<a>`, and in CSS (`<style>`, `style` and presentation attributes,
    animation values) a `url()` to another file, which becomes `none`, an `image-set()` or
    `image()` with a URL, and `@import` rules. Fragment references (`url(#gradient)`, `href="#shape"`) stay. To
    show an outside image, render the `<svg>` markup in a component of your own, or point an
    `<img>` at the file. The filter reads the CSS exactly as the page gets it, escapes
    included, and fails closed: a URL goes wherever it appears (selectors too), except in an
    `@namespace` rule, which loads nothing.
  - Elements nested more than 128 levels deep make the file an error. CSS blocks nested more
    than 64 levels deep stay but lose their content.

  Comments and editor metadata go too, and redundant markup when optimising. Ids get a per-file
  prefix, and so do the references to them (`href="#id"`, `url(#id)`, `<style>` selectors);
  class names get it too when the file has a `<style>`. Icons never clash with each other or with
  the page.

- **Optimisation.** By default SVGO runs its `preset-default` plus `convertStyleToAttrs` (fewer
  `style` attributes, for strict CSPs). Pass your own SVGO config as `optimize` to choose the
  plugins (`{ plugins: [...] }`, `multipass`, `floatPrecision`), or `false` to skip SVGO.
- **Query switches.** `./icon.svg?component` is the component. The rest are Vite's: `./icon.svg`
  and `?url` are the asset URL (or a `data:` URL for small files), `?inline` always a `data:` URL
  and `?raw` the file's text. A library that imports its own `.svg` files gets the URL it
  expects. `lumiose({ svg: false })` leaves `?component` to Vite too.

Inline is a deliberate choice over sprites (`<use href="#id">`): with the compression every
server applies, a page of repeated inline icons transfers about as many bytes as a sprite, and
inline icons render faster and can be styled and animated part by part.

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

```ts
// vite.config.ts: your own SVGO plugins (optional)
import { defineConfig } from "vite";
import lumiose from "@lumiose/vite";

export default defineConfig({
  plugins: [
    lumiose({
      svg: { optimize: { multipass: true, plugins: ["preset-default", "removeDimensions"] } },
    }),
  ],
});
```

```tsx
// src/components/Nav.stsx
import Home from "../icons/home.svg?component";
import Search from "../icons/search.svg?component";
import logoUrl from "../icons/logo.svg";

export function Nav() {
  return (
    <nav>
      <img src={logoUrl} alt="Acme" width={96} height={24} />
      <a href="/" class="link">
        <Home class="icon" /> Home
      </a>
      <button type="button">
        <Search class="icon" title="Search" />
      </button>
    </nav>
  );
}

<style>
  .link { color: rebeccapurple; }
  .icon { width: 1.25em; height: 1.25em; vertical-align: -0.2em; }
  .link:hover .icon { color: crimson; }
</style>
```

The `Home` icon is decorative (its link has text); the search button has no text, so its icon
gets a `title`. Both follow the link or button colour through `currentColor`, and `class="icon"`
receives the file's scope, so the scoped `.icon` rule applies.

## Common mistakes

- **Forgetting `?component`.** `import Icon from "./icon.svg"` is a URL string, so `<Icon />` is
  a type error ("cannot be used as a JSX component" with `vite/client` in `"types"`, "cannot find
  module" without it). Add `?component`. `?inline` is not the component either: it is Vite's
  `data:` URL.
- **Styling inner paths from a scoped block.** The paths belong to the icon component, so only the
  root `<svg>` (through `class`) carries your component's scope. Use inherited properties
  (`color`, `fill`, `stroke`, `stroke-width`) on the root, or `:deep(path)`.
- **Setting only `width`.** The file's `height` stays, and the drawing is centred in that box.
  Pass both, or size icons with CSS as above.
- **Labelling a decorative icon.** An icon next to visible text needs no `title`; a `title` there
  makes screen readers repeat the text.
- **Hard-coded colours in an icon set.** If icons stay black whatever `color` says, the files
  hard-code a colour: use `lumiose({ svg: { currentColor: true } })` for monochrome sets. It runs
  SVGO's `convertColors` before your own plugins, so with a custom config it still applies.
- **Expecting `<foreignObject>` content.** HTML inside an icon is dropped; render it with a
  component next to the icon.
- **Removing `viewBox` in a custom SVGO config.** Without `viewBox` an icon no longer scales with
  `width`/`height`; SVGO's `preset-default` keeps it, `removeViewBox` drops it.

## Related diagnostics

A file that is not well-formed SVG fails the build with its location
(`icon.svg: invalid SVG: … at 3:12`), as does a file whose root element is not `<svg>` and one
whose elements nest more than 128 levels deep.

See also: [Styles](styles.md), [JSX](jsx.md), [reference: `@lumiose/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
