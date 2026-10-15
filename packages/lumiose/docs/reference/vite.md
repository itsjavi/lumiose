# `@lumiose/vite`

> The Vite 8 plugin: compiles `.stsx` and `.tsx` files, reports diagnostics in the overlay and reloads on edit.

Install it next to `lumiose` and Vite: `pnpm add -D @lumiose/vite vite`. Both are peer
dependencies, so the plugin, the compiled modules and its Vitest setup share the app's one copy of
`lumiose`.

## lumiose()

```ts
import lumiose from "@lumiose/vite";

function lumiose(options?: LumioseOptions): Plugin[];

interface LumioseOptions {
  /** Modules compiled by Lumiose. Default: .stsx and .tsx files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
  /** The project's default route mode; a layout's or route's `export const mode` overrides it. */
  mode?: "static" | "server" | "spa"; // default "static"
  /** Whether spa routes render their content on the server (false: the shell only). */
  ssr?: boolean; // default true
  /** Whether spa pages that render on the server are prerendered at build time; a layout's or page's `export const prerender` overrides it. */
  prerender?: boolean; // default false, and not with ssr: false
  /** Trailing slashes of page URLs: "always"/"never" redirect to the canonical form. */
  trailingSlash?: "ignore" | "always" | "never"; // default "ignore"
  /** The origin check of form posts (on by default); false turns it off. */
  csrf?: false | { allowedOrigins?: readonly string[] };
  /** `.svg?component` imports as inline components; false leaves them to Vite (URLs). */
  svg?: boolean | { optimize?: boolean | SvgoConfig; currentColor?: boolean }; // default true
  /** `.md` imports as components; the hook validates or transforms each file's frontmatter. */
  md?: boolean | { frontmatter?(data: Record<string, unknown>, ctx: { file: string }): unknown }; // default false
  /** `.html` imports as components. */
  html?: boolean; // default false
  /** View Transitions (not under reduced motion): between MPA pages, and for SPA navigations. */
  viewTransitions?: boolean; // default false
  /** Speculation rules that prefetch the same-origin links of MPA pages. */
  prefetch?: "hover" | "viewport" | "none"; // default "hover"
  /** A strict Content Security Policy: nonces per response, hashes for prerendered pages. */
  csp?: "strict";
  /** Response headers: a record for every response, or rules by path (below base). */
  headers?: Record<string, string> | { path: string; headers: Record<string, string> }[];
  /** Request body limits, in bytes or "512kb"/"1mb": larger requests get 413. */
  limits?: { body?: number | string; upload?: number | string }; // default { body: "1mb", upload: "10mb" }
  /** The deploy adapter: cloudflare(), vercel() or netlify() from their @lumiose/adapter-* packages. */
  adapter?: Adapter; // default: none, the Node build
  /** Locale routing: unprefixed default locale, prefixed others, per-page locale declarations. */
  i18n?: {
    locales: string[]; // URL path segments, such as "en" or "pt-BR"
    defaultLocale: string; // served without a prefix
    missing?: "404" | "redirect"; // default "404"
    detect?: false | { cookie?: string; acceptLanguage?: boolean }; // default false
  };
  /** The site's URL, for the absolute URLs of prerendered pages (hreflang, canonical); a path is the base. */
  site?: string; // such as "https://example.com" or "https://example.com/docs"
}
```

The project options (`mode`, `ssr`, `prerender`, `trailingSlash`, `csrf`, `viewTransitions`,
`prefetch`, `headers`, `limits`, `adapter`, `i18n`, `site`) are
read by `lumiose dev`, `lumiose build` and `lumiose routes`/`check` from the plugin's `api.options`.
Invalid values and unknown option names throw when the config loads, as does `prerender: true`
with `ssr: false` ([prerendered SPA routes](../concepts/rendering-modes.md#prerendered-spa-routes)). `csp: "strict"` is
described in [Security](../concepts/security.md): nonces on every inline script and style Lumiose
writes and on those written in JSX, static `style` strings as nonce'd rules, a `Content-Security-Policy` header for pages rendered per request, and a hash policy
`<meta>` in prerendered pages. `allowedOrigins` takes full
origins such as `"https://app.example.com"`, without a path or trailing slash.

**Response headers** (`headers`). Declare them once: a record applies to every response; rules
apply to the paths they match, below Vite's `base` (`*` matches one segment, `**` any number,
later rules win for the same header). `lumiose dev`, `lumiose preview` and `@lumiose/adapter-node` send
them on every response, static files included, and `lumiose build` writes them to
`dist/client/_headers`, the file Netlify and Cloudflare Pages read (`**` becomes `*`, a `*`
segment a `:name` placeholder). Headers that middleware, endpoints or `response().setHeader()` set
win. Two headers are sent by default, as Rails and Django do: `X-Content-Type-Options: nosniff` and
`Referrer-Policy: strict-origin-when-cross-origin`; give them another value in `headers`, or `""`
to remove one (`_headers` gets `! name`).

**Locales** (`i18n`) and **site** (`site`). With `i18n`, route files stay unprefixed: the
default locale is served at `/about`, the others under their prefix (`/es/about`), and a page
exists in the locales it declares with `export const locales`. `missing` decides what a page
requested in another locale answers, `detect` redirects visitors to their locale on entry only. See
[Internationalization](../concepts/i18n.md). `site` is the site's URL (`"https://example.com"`):
prerendered pages have no request, so their absolute `hreflang` and canonical URLs are its origin
followed by the `href()` path, which already has Vite's `base` and the trailing-slash policy;
without `site` they are root-relative, and `lumiose build` warns. Pages rendered per request use
the request's origin. A path in `site` (`"https://example.com/docs"`, trailing slash optional) is
the app's base: it becomes Vite's `base` when the config sets none, and a config `base` that
differs from it is an error naming both, so the path is never counted twice.

**Body limits** (`limits`). `body` caps URL-encoded forms, JSON and any other non-multipart
request body (default `"1mb"`), `upload` caps `multipart/form-data` bodies (default `"10mb"`). A
route's `export const limits = { upload: "100mb" }` overrides them for its requests. See
[Security](../concepts/security.md).

```ts
lumiose({
  headers: [
    { path: "/**", headers: { "cross-origin-opener-policy": "same-origin" } },
    { path: "/admin/**", headers: { "x-robots-tag": "noindex" } },
  ],
});
```

| Deployment                         | Where the headers come from                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `lumiose dev`, `lumiose preview`   | `lumiose({ headers })`                                                              |
| `@lumiose/adapter-node`            | `lumiose({ headers })`, from the build (`config.headers` of `dist/server/entry.js`) |
| `dist/server/entry.js` (Bun, Deno) | `lumiose({ headers })`, from the build, on static files and the app's responses     |
| Cloudflare, Netlify adapters       | `dist/client/_headers` for static files; the build's handler for the rest           |
| Vercel adapter                     | `config.json` routes                                                                |
| Netlify, Cloudflare Pages          | `lumiose({ headers })`, as `dist/client/_headers`                                   |
| Other static hosts and CDNs        | The host's own header configuration, copied from `lumiose({ headers })`             |

Per-response headers that depend on the request belong in middleware or `response().setHeader()`.

**Deploy adapters** (`adapter`, decision-45). After prerendering, `lumiose build` hands the build to
the adapter, which writes the platform's output: `cloudflare()` from
`@lumiose/adapter-cloudflare` ([guide](../deploy/cloudflare.md)), `vercel({ runtime })` from
`@lumiose/adapter-vercel` ([guide](../deploy/vercel.md)), `netlify()` from
`@lumiose/adapter-netlify` ([guide](../deploy/netlify.md)). These platforms serve `dist/client`
themselves and compress on their own, so the build writes no `.br`/`.gz` copies and the server
build has no static file layer. Without an adapter, the output is the Node build that
`@lumiose/adapter-node`, Bun and Deno serve ([Deploy](../deploy/README.md)). The adapter packages
have named exports only:

```ts
import { cloudflare } from "@lumiose/adapter-cloudflare";

lumiose({ adapter: cloudflare() });
```

MPA navigation ([Routing](../concepts/routing.md)): the page documents that `lumiose dev` and
`lumiose build` render get, in `<head>`:

- `viewTransitions: true`:
  `<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>`,
  on every page, `spa` pages included (their client navigations are not cross-document: the SPA
  router swaps their pages inside [`viewTransition()`](components.md#viewtransition) instead).
- `prefetch`: a `<script type="speculationrules">` on every page except `spa` pages, whose
  `<Link prefetch>` prefetches instead. It matches the links below Vite's `base` (`href_matches`),
  except the URLs of endpoints, with `moderate` eagerness for `"hover"` (the pointer rests on the
  link, or it is pressed) and `eager` for `"viewport"` (as soon as the browser sees fit: desktop
  Chromium on a brief hover, mobile Chromium as links enter the viewport); `"none"` emits nothing.
  On a page with `<Link prefetch>` links (marked `data-l-prefetch`), the rules give each level its
  own `selector_matches` rule, and the default's rule skips links marked otherwise; with `"none"`,
  only such pages get rules ([`lumiose/router`](router.md#link)).

Both are inline elements: a Content-Security-Policy you set without `'unsafe-inline'` needs
`'inline-speculation-rules'` in `script-src` for the rules, and the hash of the `<style>` in
`style-src`.

What it does:

- Compiles Lumiose modules before Vite's own transform, which is told to skip them. Server consumers
  (SSR) get `lumiose/server` code; everything else gets `lumiose/dom` code.
- Resolves `lumiose` to its `browser` entry in client environments and its `node` entry in server
  environments, and keeps every `lumiose` entry out of dependency pre-bundling, so compiled code and
  the runtime share one module instance. Under Vitest, tests in a DOM environment (`happy-dom`,
  `jsdom`) get the `browser` entry too (see [Testing](../concepts/testing.md)).
- Turns compiler diagnostics into Vite warnings and errors with code frames (the dev overlay).
- Names scoped state: each module-scope `defineState()` binding imported from `lumiose` gets an id
  after its module and export (`/src/lib/cart.ts#cart`), as island refs do, where client code
  (islands, SPA routes) reaches it; pages send only those states' values
  ([`defineState`](reactivity.md#definestate)). Under Vitest it adds a setup file that resets
  scoped state before each test.
- Loads `.svg?component` imports (`./icon.svg?component`, or a package's
  `lucide-static/icons/house.svg?component`) as inline components for the environment's target,
  optimised with SVGO (`optimize`: `true` for Lumiose's defaults, `preset-default` plus
  `convertStyleToAttrs`; your SVGO config; or `false`). Scripts, event handlers and
  `javascript:` URLs are always removed and ids prefixed per file. `currentColor: true` replaces
  every colour with `currentColor` (SVGO's `convertColors`, before other plugins). Every other
  `.svg` import (bare, `?url`, `?inline`, `?raw`) is Vite's. See
  [SVG imports](../concepts/svg.md).
- With `md`/`html`, loads project `.md` and `.html` files as static components: their source
  becomes the Lumiose module `<file>.md.stsx` (`.html.stsx`), compiled like any `.stsx` file, with
  `frontmatter` from `<file>.md?lumiose-frontmatter`, `headings`, relative asset URLs as `?url`
  imports, and client scripts loaded by an island from `<file>.html?lumiose-script`. HTML entries (`index.html`, HTML build inputs) and `public/` files
  stay Vite's. See [Markdown and HTML imports](../concepts/content.md).
- Hot updates: an edited component re-renders in place, in every instance, and the rest of the page
  keeps its DOM and state (`lumiose dev` registers each named component of client code with
  `lumiose/dom/hot`). Only the components whose code changed re-render; an edit outside every
  component of the file (a constant, a helper) re-renders all of the file's components. Components
  hydrated in an island or on the SPA's first page update the same way once hydrated. A module
  whose exports are not all such components (a constant or signal export, a changed export list,
  an async or anonymous default component) falls back to the app entry: a client module that imports `render` from `lumiose/dom` accepts
  updates of every module it reaches and re-renders the app into the same container (component
  state resets; module-level signals of unchanged modules survive), else the page reloads.
- Style blocks become `<file>?lumiose&type=style&lang.css` modules handled by Vite's CSS pipeline.
  Modules that `$` references import constants from are tracked as dependencies of that CSS module.
  A style-only edit, or an edit to such a constants module, hot-updates the CSS without remounting.

> **Status:** compilation, environments, diagnostics, HMR, style-block CSS, `.svg`, `.md` and `.html` imports and the
> project options above are available. The designed option `css` is not.

## createDevHandler()

```ts
import { createDevHandler } from "@lumiose/vite/dev";

function createDevHandler(options?: DevHandlerOptions): Promise<DevHandler>;

interface DevHandlerOptions {
  /** Your HTTP server: Vite's HMR WebSocket upgrades there. Default: HMR on a port of its own. */
  server?: import("node:http").Server;
  root?: string; // default: the current directory
  configFile?: string | false; // default: vite.config.* in the root
  mode?: string; // Vite mode (.env files), default "development"
  routesDir?: string; // default "src/routes"
  logLevel?: LogLevel;
  customLogger?: Logger;
}

interface DevHandler {
  (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void): void;
  readonly vite: ViteDevServer; // Vite in middleware mode
  close(): Promise<void>; // stops Vite (watcher, HMR); your server stays open
}
```

`lumiose dev` inside your own Node server (decision-52). It starts Vite in middleware mode with the
project's `vite.config.ts` and returns a handler of the same kind as `@lumiose/adapter-node`'s
[`createHandler()`](adapter-node.md#createhandler): a request listener, or connect/Express
middleware (errors go to `next`). Everything `lumiose dev` does works through it: modules and
assets, the routes, the error overlay, HMR, in-place updates after server-only edits and typegen.
Pass your server as `server` so HMR shares its port: Vite takes only its own upgrades
(`Sec-WebSocket-Protocol: vite-hmr`) and leaves the others to your `upgrade` listeners, so
leave an upgrade alone, rather than destroying it, when your code does not handle it in dev.
`lumiose dev` stays the default; this is for projects that own their server. `@lumiose/vite` is a
dev dependency: import it only in dev, and production never loads Vite.

```ts
// server.ts: `node server.ts --dev` in dev, `node server.ts` after `lumiose build`
import { createServer } from "node:http";
import { createHandler } from "@lumiose/adapter-node";

const dev = process.argv.includes("--dev");
const server = createServer();
const handler = dev
  ? await (await import("@lumiose/vite/dev")).createDevHandler({ server })
  : await createHandler();
server.on("request", handler);
server.listen(3000);
```

## Example

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ mode: "server", exclude: /[\\/](node_modules|legacy)[\\/]/ })],
});
```
