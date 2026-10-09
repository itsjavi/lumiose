# `lumen/vite`

> The Vite 8 plugin: compiles `.stsx` and `.tsx` with the Lumen compiler, picks the `lumen` entry per Vite environment, reports diagnostics in the overlay and reloads on edit.

## lumen()

```ts
import lumen from "lumen/vite";

function lumen(options?: LumenOptions): Plugin[];

interface LumenOptions {
  /** Modules compiled by Lumen. Default: .stsx and .tsx files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
  /** The project's default route mode; a layout's or route's `export const mode` overrides it. */
  mode?: "static" | "server" | "spa"; // default "static"
  /** Whether spa routes render their content on the server (false: the shell only). */
  ssr?: boolean; // default true
  /** Trailing slashes of page URLs: "always"/"never" redirect to the canonical form. */
  trailingSlash?: "ignore" | "always" | "never"; // default "ignore"
  /** The origin check of form posts (on by default); false turns it off. */
  csrf?: false | { allowedOrigins?: readonly string[] };
  /** `.svg` imports as inline components; false leaves them to Vite (URLs). */
  svg?: boolean | { optimize?: boolean | SvgoConfig; currentColor?: boolean }; // default true
  /** `.md` imports as components; the hook validates or transforms each file's frontmatter. */
  md?: boolean | { frontmatter?(data: Record<string, unknown>, ctx: { file: string }): unknown }; // default false
  /** `.html` imports as components. */
  html?: boolean; // default false
  /** Cross-document View Transitions between MPA pages (not under reduced motion). */
  viewTransitions?: boolean; // default false
  /** Speculation rules that prefetch the same-origin links of MPA pages. */
  prefetch?: "hover" | "viewport" | "none"; // default "hover"
  /** A strict Content Security Policy: nonces per response, hashes for prerendered pages. */
  csp?: "strict";
  /** Response headers: a record for every response, or rules by path (below base). */
  headers?: Record<string, string> | { path: string; headers: Record<string, string> }[];
}
```

The project options (`mode`, `ssr`, `trailingSlash`, `csrf`, `viewTransitions`, `prefetch`,
`headers`) are
read by `lumen dev`, `lumen build` and `lumen routes`/`check` from the plugin's `api.options`.
Invalid values and unknown option names throw when the config loads. `csp: "strict"` is
described in [Security](../concepts/security.md): nonces on every inline script and style Lumen
writes and on those written in JSX, static `style` strings as nonce'd rules, a `Content-Security-Policy` header for pages rendered per request, and a hash policy
`<meta>` in prerendered pages. `allowedOrigins` takes full
origins such as `"https://app.example.com"`, without a path or trailing slash.

**Response headers** (`headers`). Declare them once: a record applies to every response; rules
apply to the paths they match, below Vite's `base` (`*` matches one segment, `**` any number,
later rules win for the same header). `lumen dev`, `lumen preview` and `@lumen/adapter-node` send
them on every response, static files included, and `lumen build` writes them to
`dist/client/_headers`, the file Netlify and Cloudflare Pages read (`**` becomes `*`, a `*`
segment a `:name` placeholder). Headers that middleware, endpoints or `response().setHeader()` set
win.

```ts
lumen({
  headers: [
    { path: "/**", headers: { "cross-origin-opener-policy": "same-origin" } },
    { path: "/admin/**", headers: { "x-robots-tag": "noindex" } },
  ],
});
```

| Deployment                   | Where the headers come from                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `lumen dev`, `lumen preview` | `lumen({ headers })`                                                              |
| `@lumen/adapter-node`        | `lumen({ headers })`, from the build (`config.headers` of `dist/server/entry.js`) |
| Netlify, Cloudflare Pages    | `lumen({ headers })`, as `dist/client/_headers`                                   |
| Other static hosts and CDNs  | The host's own header configuration, copied from `lumen({ headers })`             |

Per-response headers that depend on the request belong in middleware or `response().setHeader()`.

MPA navigation ([Routing](../concepts/routing.md)): the page documents that `lumen dev` and
`lumen build` render get, in `<head>`:

- `viewTransitions: true`:
  `<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>`,
  on every page, `spa` pages included (their client navigations are not cross-document).
- `prefetch`: a `<script type="speculationrules">` on every page except `spa` pages, whose
  `<Link prefetch>` prefetches instead. It matches the links below Vite's `base` (`href_matches`),
  except the URLs of endpoints, with `moderate` eagerness for `"hover"` (the pointer rests on the
  link, or it is pressed) and `eager` for `"viewport"` (as soon as the browser sees fit: desktop
  Chromium on a brief hover, mobile Chromium as links enter the viewport); `"none"` emits nothing.
  On a page with `<Link prefetch>` links (marked `data-l-prefetch`), the rules give each level its
  own `selector_matches` rule, and the default's rule skips links marked otherwise; with `"none"`,
  only such pages get rules ([`lumen/router`](router.md#link)).

Both are inline elements: a Content-Security-Policy you set without `'unsafe-inline'` needs
`'inline-speculation-rules'` in `script-src` for the rules, and the hash of the `<style>` in
`style-src`.

What it does:

- Compiles Lumen modules before Vite's own transform, which is told to skip them. Server consumers
  (SSR) get `lumen/server` code; everything else gets `lumen/dom` code.
- Resolves `lumen` to its `browser` entry in client environments and its `node` entry in server
  environments, and keeps every `lumen` entry out of dependency pre-bundling, so compiled code and
  the runtime share one module instance. Under Vitest, tests in a DOM environment (`happy-dom`,
  `jsdom`) get the `browser` entry too (see [Testing](../concepts/testing.md)).
- Turns compiler diagnostics into Vite warnings and errors with code frames (the dev overlay).
- Loads project `.svg` files (`./icon.svg`, `./icon.svg?inline`) as inline components for the
  environment's target, optimised with SVGO (`optimize`: `true` for Lumen's defaults,
  `preset-default` plus `convertStyleToAttrs`; your SVGO config; or `false`). Scripts, event
  handlers and `javascript:` URLs are always removed and ids prefixed per file. `currentColor:
  true` replaces every colour with `currentColor` (SVGO's `convertColors`, before other
  plugins). `?url` and `?raw` stay Vite's, and `.svg` files in `exclude` (node_modules) keep
  Vite's URL import. See [SVG imports](../concepts/svg.md).
- With `md`/`html`, loads project `.md` and `.html` files as static components: their source
  becomes the Lumen module `<file>.md.stsx` (`.html.stsx`), compiled like any `.stsx` file, with
  `frontmatter` from `<file>.md?lumen-frontmatter`, `headings`, relative asset URLs as `?url`
  imports, and client scripts loaded by an island from `<file>.html?lumen-script`. HTML entries (`index.html`, HTML build inputs) and `public/` files
  stay Vite's. See [Markdown and HTML imports](../concepts/content.md).
- Hot updates: a client module that imports `mount` from `lumen/dom` (an app entry) accepts updates
  of every module it reaches and re-mounts the app into the same container. Component state resets;
  module-level signals of unchanged modules survive.
- Style blocks become `<file>?lumen&type=style&lang.css` modules handled by Vite's CSS pipeline.
  Modules that `$` references import constants from are tracked as dependencies of that CSS module.
  A style-only edit, or an edit to such a constants module, hot-updates the CSS without remounting.

> **Status:** compilation, environments, diagnostics, HMR, style-block CSS, `.svg`, `.md` and `.html` imports and the
> project options above are available. The designed options `adapter` and `css` are not.

## Example

```ts
// vite.config.ts
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen({ mode: "server", exclude: /[\\/](node_modules|legacy)[\\/]/ })],
});
```
