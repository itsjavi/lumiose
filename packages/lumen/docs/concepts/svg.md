# SVG imports

> `import Icon from "./icon.svg"` gives an inline SVG component: optimised at build time, styled with `currentColor` and props, labelled with `title`, the same on the server, the client and in islands. `?url` and `?raw` keep Vite's meaning.

## Concept

With the Lumen Vite plugin, an `.svg` file in your project imports as a component. The build
optimises the file (OXVG, a Rust port of SVGO's default preset) and compiles it into a static
template, so rendering an icon clones markup, on the server and in the browser alike. The icon is
**inline**: its paths are part of the page's HTML, CSS reaches them, and nothing is fetched.

- **Props override the file.** The file's root attributes (`width`, `height`, `viewBox`, `fill`,
  `stroke`, `class`, …) are defaults; any `<svg>` prop you pass replaces the matching one:
  `class`, `style`, `width`, `height`, `fill`, `aria-*`, events and `ref`.
- **Colour.** Icons drawn with `currentColor` follow the text colour (`color` in CSS). For icons
  with a hard-coded colour, set `lumen({ svg: { currentColor: true } })` to replace every colour
  with `currentColor`, or pass `fill`/`stroke` props.
- **Accessibility.** Without `title`, `aria-label` or `aria-labelledby`, an icon is decorative
  and gets `aria-hidden="true"`. `title="Home"` renders `<title>` as the first child, with
  `role="img"` and `aria-labelledby` pointing at it. The id comes from the file and the title
  text, so the server and the client agree without a counter. The file's own `<title>` is
  dropped: the prop is the label.
- **What the build removes.** Scripts, event attributes (`onload`) and `javascript:` URLs always;
  editor metadata, comments and redundant markup when optimising. Ids get a per-file prefix (and
  class names too, when the file has a `<style>`), so icons never clash with each other or with
  the page.
- **Query switches.** `./icon.svg` and `./icon.svg?inline` are the component. `?url` is Vite's
  asset URL (or a `data:` URL for small files) and `?raw` the file's text.
- **Dependencies.** `.svg` files under `node_modules` (the plugin's `exclude`) keep Vite's URL
  import, which is what a library importing an `.svg` expects. `lumen({ svg: false })` leaves
  every `.svg` import to Vite.

Inline is a deliberate choice over sprites (`<use href="#id">`): with the compression every
server applies, a page of repeated inline icons transfers about as many bytes as a sprite, and
inline icons render faster and can be styled and animated part by part.

## API

| Import / option                          | Gives                                                       |
| ---------------------------------------- | ----------------------------------------------------------- |
| `import Icon from "./icon.svg"`          | `(props: JSX.SVGProps<SVGSVGElement> & { title?: string })` |
| `import Icon from "./icon.svg?inline"`   | The same component                                          |
| `import url from "./icon.svg?url"`       | The asset URL (`string`, Vite)                              |
| `import text from "./icon.svg?raw"`      | The file's text (`string`, Vite)                            |
| `lumen({ svg: { optimize: false } })`    | Skip the optimiser (safety transforms still run)            |
| `lumen({ svg: { currentColor: true } })` | Replace every colour with `currentColor`                    |
| `lumen({ svg: false })`                  | `.svg` imports stay Vite's URLs                             |

The types come with `lumen/env` (`"types": ["lumen/env"]` in `tsconfig.json`).

## Example

```tsx
// src/components/Nav.stsx
import Home from "../icons/home.svg";
import Search from "../icons/search.svg";
import logoUrl from "../icons/logo.svg?url";

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
      <style>
        .link { color: rebeccapurple; }
        .icon { width: 1.25em; height: 1.25em; vertical-align: -0.2em; }
        .link:hover .icon { color: crimson; }
      </style>
    </nav>
  );
}
```

The `Home` icon is decorative (its link has text); the search button has no text, so its icon
gets a `title`. Both follow the link or button colour through `currentColor`, and `class="icon"`
receives the component's scope, so the scoped `.icon` rule applies.

## Common mistakes

- **Expecting a URL.** Before Lumen, `import icon from "./icon.svg"` was a URL string in Vite.
  Use `./icon.svg?url` for `<img src>` and CSS, or `lumen({ svg: false })` for the old behaviour
  everywhere.
- **Loading `vite/client` types first.** `vite/client` also declares `*.svg` (as a string), and
  whichever comes first in `"types"` wins: `Icon` then "cannot be used as a JSX component". List
  `lumen/env` first, or drop `vite/client` (`lumen/env` already types `import.meta.env`).
- **Styling inner paths from a scoped block.** The paths belong to the icon component, so only the
  root `<svg>` (through `class`) carries your component's scope. Use inherited properties
  (`color`, `fill`, `stroke`, `stroke-width`) on the root, or `:deep(path)`.
- **Setting only `width`.** The file's `height` stays, and the drawing is centred in that box.
  Pass both, or size icons with CSS as above.
- **Labelling a decorative icon.** An icon next to visible text needs no `title`; a `title` there
  makes screen readers repeat the text.
- **Hard-coded colours in an icon set.** If icons stay black whatever `color` says, the files
  hard-code a colour: use `lumen({ svg: { currentColor: true } })` for monochrome sets.

## Related diagnostics

A file that is not well-formed SVG fails the build with its location
(`icon.svg: invalid SVG: … at 3:12`), as does a file whose root element is not `<svg>`.

See also: [Styles](styles.md), [JSX](jsx.md), [reference: `lumen/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
