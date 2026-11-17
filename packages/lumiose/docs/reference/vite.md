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
  /** Modules left to Vite. Default: node_modules, except the Lumiose packages installed there. */
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
  /** How scoped <style> blocks mark and match their elements (decision-85). */
  scopedStyles?: {
    strategy?: "attribute" | "class"; // default "attribute": data-lum-<hash>; "class": lum-<hash>
    specificity?: "default" | "zero"; // default "default": +0,1,0; "zero": :where(), +0
    namespace?: string; // default "lum"
  };
  /** Response headers: a record for every response, or rules by path (below base). */
  headers?: Record<string, string> | { path: string; headers: Record<string, string> }[];
  /** Request body limits, in bytes or "512kb"/"1mb": larger requests get 413. */
  limits?: { body?: number | string; upload?: number | string }; // default { body: "1mb", upload: "10mb" }
  /** How long a page render waits for pending <Suspense> boundaries: milliseconds, "30s", "500ms", "2m", or false. */
  streamTimeout?: number | string | false; // default "30s"
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
  /** The in-page inspector of `lumiose dev` (Alt+Shift+L, Alt+click to the source); dev only. */
  inspector?: boolean; // default true
}
```

The project options (`mode`, `ssr`, `prerender`, `trailingSlash`, `csrf`, `viewTransitions`,
`prefetch`, `headers`, `limits`, `streamTimeout`, `adapter`, `i18n`, `site`, `inspector`) are
read by `lumiose dev`, `lumiose build` and `lumiose routes`/`check` from the plugin's `api.options`.
Invalid values and unknown option names throw when the config loads, as does `prerender: true`
with `ssr: false` ([prerendered SPA routes](../concepts/rendering-modes.md#prerendered-spa-routes)). `csp: "strict"` is
described in [Security](../concepts/security.md): nonces on every inline script and style Lumiose
writes and on those written in JSX, static `style` strings as nonce'd rules, a `Content-Security-Policy` header for pages rendered per request, and a hash policy
`<meta>` in prerendered pages. `allowedOrigins` takes full
origins such as `"https://app.example.com"`, without a path or trailing slash.

**Scope markers** (`scopedStyles`, decision-85). How elements carry the scope of `<style>` blocks
and how scoped selectors match it: `data-lum-<hash>` attributes with a +0,1,0 bump by default;
`strategy: "class"` uses `lum-<hash>` classes merged into each element's `class`, `specificity:
"zero"` wraps the marker in `:where()`, and `namespace` replaces `lum`. Every compile of the app
uses it, so templates and CSS agree. See [scopedStyles](styles.md#scopedstyles).

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

**In-page inspector** (`inspector`, decision-59). `lumiose dev` mounts the inspector on every page
from its dev client: Alt+Shift+L or the corner button opens the component tree, signals, islands
and why something updated, and Alt+click opens an element's source through Vite's open-in-editor
endpoint ([Dev tools](../concepts/dev-tools.md)). In dev, the plugin also compiles every element that renders a box (not `<title>`, `<meta>` and
the like) with `data-lumiose-source="<file>:<line>:<column>"`, signal and computed variables with their names, and
component registrations with their locations, and the runtime records for the inspector behind the
`import.meta.env.LUMIOSE_INSPECTOR` define. Builds and Vitest get none of it. `inspector: false`
removes all of it from `lumiose dev` too.

**Body limits** (`limits`). `body` caps URL-encoded forms, JSON and any other non-multipart
request body (default `"1mb"`), `upload` caps `multipart/form-data` bodies (default `"10mb"`). A
route's `export const limits = { upload: "100mb" }` overrides them for its requests. Sizes are
bytes or strings with `b`, `kb`, `mb` or `gb` (1024-based); a size past 2^53 - 1 bytes is an
error. See [Security](../concepts/security.md).

**Streaming timeout** (`streamTimeout`). How long a page render waits for its pending
`<Suspense>` boundaries, from the start of the render: milliseconds, or a string with `ms`, `s` or
`m` (`"30s"`, the default). Once it expires, async components still waiting fail with
[`LUM5009`](../errors/LUM5009.md): the nearest `<ErrorBoundary>` renders its fallback into the
stream, a boundary without one keeps its `<Suspense>` fallback, `onRequestError` receives the error
with phase `"stream"`, and the response ends. It applies to `lumiose dev` and the build output on
every host, also to responses that `response().setStreaming(false)` resolves in full; prerendering
ignores it. `false` waits as long as the client stays connected. Values past 2^31 - 1 ms are an
error. See [Rendering modes](../concepts/rendering-modes.md#how-pages-render).

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
  imports, and its `<script>` elements loaded as a `?client` script from
  `<file>.html?lumiose-script`, without an island. HTML entries (`index.html`, HTML build inputs) and `public/` files
  stay Vite's. See [Markdown and HTML imports](../concepts/content.md).
- Loads `?client` imports (`./menu.element.ts?client`): client environments get the module itself
  and a default export that does nothing, or, when the importer only calls the import
  conditionally (never as a statement of its own), a default export that imports the module on
  its first call; server environments get a default export that adds the
  module's script to the page being rendered, without running the module. Builds build each script
  that the project scan finds as a chunk of its own: every one of the app's, and those of the
  [Lumiose packages](#lumiose-packages)' modules that the app's modules can use. See
  [Islands](../concepts/islands.md) ("Scripts of server-rendered components").
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

## Lumiose packages

A **Lumiose package** is a dependency that lists `lumiose` in its `dependencies` or
`peerDependencies` (any dependency field), found from the app's `package.json` and, transitively,
from the Lumiose packages themselves. `@lumiose/ui` and any component library built for Lumiose
are; Lumiose's own tooling (`@lumiose/cli`, `@lumiose/vite`, the adapters, the editor plugins) is
not. The plugin treats their modules like the app's own, whether the package is linked
(`"@acme/ui": "workspace:*"`) or installed in `node_modules` from npm or a tarball:

- **Compiled with the app's options.** Their `.tsx` and `.stsx` modules go through the Lumiose
  compiler for the server or the browser, with the app's targets, CSP mode and dev tools, in
  `lumiose dev` and builds alike. The default `exclude` leaves every other package in
  `node_modules` to Vite; an explicit `exclude` replaces that rule, so `exclude: /node_modules/`
  compiles no installed package.
- **Scanned with the project.** Builds find their island call sites, stylesheets and
  [client scripts](../concepts/islands.md#concept) (`?client`) before the server graph
  exists, so their islands get chunks and their pages load their scripts. An installed package is
  scanned whole, `dist/` included, but not the packages in its own `node_modules`; a linked one
  without its build output (`dist/`, `build/`) and nested projects (a folder with a
  `package.json`, `tsconfig.json` or `vite.config.*`). A build builds only the client scripts of
  the package modules the app's modules can run: it follows their imports by name, through
  re-exports, so `import { Tabs } from "@lumiose/ui"` builds the script of Tabs and not those of the
  other components. A module that runs builds all its scripts, whichever export the app uses. A
  package that may resolve its modules differently in the browser and on the server (`exports` or
  `imports` conditions such as `browser` or `node`, or a `browser` field) builds all of its
  scripts. When the imports cannot be followed (a package module with an `import()` of a computed
  specifier, or `import.meta.glob()`), the build builds every script, as it would without the scan.
- **One `lumiose`.** They are bundled with the server code (`resolve.noExternal`) and kept out of
  Vite's dependency pre-bundling (`optimizeDeps.exclude`), so their modules and the app's share one
  runtime instance, and Vite never compiles their JSX for React. Their CommonJS dependencies,
  which the browser can only import pre-bundled, are added to the browser's
  `optimizeDeps.include` for you (`"@acme/ui > some-cjs-dep"`); ES-module dependencies are served
  as they are.
- **Stable names.** Island refs and scope tokens name their modules package-relatively
  (`@acme/ui/dist/Nav.tsx#Nav`), wherever the package manager put them (`node_modules/.pnpm/…`
  included).
- **Their warnings stay theirs.** Compiler warnings in an installed package's files (`LUM2001`, …)
  are the package's to fix, not the app's: `lumiose dev` says once per package that it has some,
  and a build ends with one line per package, its codes and their counts, instead of each warning.
  A linked package is being worked on, so its warnings show like the app's. Errors always show.

**Publishing a component library.** Ship the sources (`.tsx`, `.stsx`, `.ts`, `.css`) and point
`exports` at them, with `lumiose` as a peer dependency: no build step, and the app's compiler
compiles them for its own server and browser targets. List client scripts and stylesheets in
`sideEffects` (`["**/*.css", "**/*.script.ts"]`), so bundlers keep their side-effect imports.
`@lumiose/ui` is published this way (`dist/` holds a copy of `src/` without tests).

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

## How the compiler works

**Pipeline.** For each `.stsx`/`.tsx` module the Vite plugin calls the compiler, which:

1. **scans** the file for `<style>` blocks and masks them (replaces them with spaces, keeping every
   offset), so the rest is valid TSX;
2. parses and analyses the TSX: components, props, compiled idioms, `await` sites, islands and
   `$name` references;
3. compiles the CSS (scoping by placement, `$name` substitution, constant math folding, targets,
   minification);
4. generates JS for the **client** (cloned templates, bindings, delegated events) or the **server**
   (string concatenation with escaping), with source maps. Types are stripped.

Vite's own JSX transform is disabled for Lumiose files, and `node_modules` is excluded, except the
[Lumiose packages](#lumiose-packages) installed there.

**The masking invariant.** Masked TSX parses as valid TSX with identical offsets. Tools rely on it:
TypeScript type-checks _shadow files_ (`.lumiose/shadow/<path>.stsx.tsx`, the masked text), so
errors map back to the same line and column of the `.stsx`. `$name` references stay in place as
real TS expressions (`$radius.lg` becomes `{radius.lg}` inside JSX, `;radius.lg;` at top level), so
TypeScript checks them too.

**Scanner rules.**

- `<style` must be followed by whitespace or `>`; it is recognised wherever a JSX element can
  start. Inside JSX text, quotes (as in `Don't`) do not start strings.
- The only attribute is `global`; content runs to the first `</style>`.
- A `<style>` inside `<svg>` is native SVG CSS: emitted verbatim and unscoped.

**Diagnostics.** Every diagnostic has the shape
`{ code, severity, message, span, labels, help, fix?, docs }`. Codes are stable forever and never
reused; the compiler's registry is the source of truth, and the [error pages](../errors/README.md)
are generated from it. They appear in the Vite overlay, in `lumiose check`, in the editor and in
`--format json` output.

**Tooling on top.** `lumiose check` (typegen, shadow files, `tsc --noEmit`, scanner and compiler
diagnostics), `lumiose lint` (oxlint on shadows, optional stylelint on blocks), `lumiose fmt` (oxfmt
plus each block's CSS), and the language server (a TypeScript LSP proxy plus CSS features in
blocks, the compiler's diagnostics as you type and each JSX expression's execution contract in
hovers) all share the one scanner. TypeScript plugins
are not used.

**Mistakes with the compiler and its tools.**

- **Running bare `tsc` without shadow files.** `import "./X.stsx"` only resolves after shadows
  exist. Run `lumiose check` (or `lumiose typegen`), or keep the dev server or editor running.
- **A `tsconfig.json` that neither extends `.lumiose/tsconfig.generated.json` nor sets `rootDirs`
  and `.lumiose/shadow`.** `lumiose check` reports the missing options (`LUM6001`); extend the
  generated file ([tsconfig](jsx.md#tsconfigjson)).
- **Importing `.stsx` across `src/` or from a workspace package with a standalone tsconfig.** Its
  `rootDirs` only pair `src`. Extend `.lumiose/tsconfig.generated.json` instead
  ([tsconfig](jsx.md#imports-outside-src-and-stsx-from-other-packages)).
- **Ignoring a code because the message is short.** Run `lumiose explain <code>` for the cause and
  the fix.
- **Expecting TypeScript plugins.** Lumiose uses stock `tsc` and a language server; there is no TS
  plugin to configure.

## The dev inspector

`lumiose dev` adds an **inspector** to every page, in place of a browser extension such as React
DevTools. Press **Alt+Shift+L**, or click the small orb in the bottom-left corner, to open it at the
bottom of the window. It renders in a closed shadow root, so your styles do not reach it and your
tests' locators do not find it, and it works under `lumiose({ csp: "strict" })`.

It has four panels:

| Panel                   | Shows                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tree**                | The components the browser runs (islands, `spa` pages, `render()` roots), nested as they render. Select one for its props (getters are read safely, `children` is not), its source location, what it owns and, for an island's root, the island. Hovering a row outlines its DOM.                                                                                                                                 |
| **Signals**             | The signals, computeds and store properties a component created, or those created outside components (module scope, event handlers): the current value, what depends on them, and the last write (old → new value, when, and where). Below, its effects and bindings with their run counts. Lumiose's own signals (a resource's state, a `<Suspense>` count, the router's URL) are hidden until you ask for them. |
| **Islands**             | Every island on the page: its `client:*` strategy, its state (`waiting`, `loading`, `hydrating`, `hydrated`, `failed`), when the loader armed it, how long its module took to load and how long hydration took, and the error of an island that failed to load or hydrate.                                                                                                                                        |
| **Why did this update** | For the element you select (⌖ **Select**, then click it on the page), the bindings that update it and, for each, the writes that last re-ran it, through the computeds in between: `doubled ← count: 1 → 2 in src/Counter.stsx (onClick)`. Below, the latest updates on the page.                                                                                                                                 |

**Alt+click** any element to open its source at the line in your editor, through Vite's
open-in-editor endpoint. It works on server-rendered markup too, not only on islands: in dev, the
compiler gives every element that renders a box a `data-lumiose-source="src/routes/page.stsx:12:5"`
attribute, on the server and in the browser alike (not `<head>` elements such as `<title>`). While you hold Alt, the element it would open is outlined.

**What the inspector sees.** Server-only components (pages and layouts of `static` and `server`
routes) run on the server, so they have no client tree: the Tree lists islands and `spa` pages,
and Alt+click covers everything. Signal names come from the variables they are assigned to
(`const count = signal(0)`), which the compiler passes in dev; a signal assigned elsewhere shows as
`signal #12`.

**It costs nothing in builds.** The reactive core, the DOM runtime and the island loader report to
the inspector's registry only behind a dev-only flag that `lumiose dev` sets, so `lumiose build`
output contains none of it, byte for byte. `lumiose({ inspector: false })` turns it off in dev too:
no corner button, no shortcut, no source attributes, no recording.

Vite opens files with [`launch-editor`](https://github.com/yyx990803/launch-editor): the editor named
by the `LAUNCH_EDITOR` environment variable, else the one it finds running, else `VISUAL` or
`EDITOR`.

**Mistakes with the inspector.**

| Mistake                                                    | What happens                                                                                                                                | Instead                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Looking for a page's server component in Tree              | It is not there: it ran on the server.                                                                                                      | Alt+click its markup to open it; Tree lists what runs in the browser.                                    |
| Reading a computed marked `(stale)` as wrong               | Nothing read it since its inputs changed, so it has not re-evaluated (computeds are lazy).                                                  | It updates on its next read. The inspector never evaluates it, so it never changes what your app runs.   |
| Expecting the line where a signal was written              | The last write names the file and the function, not the line: the stack has compiled positions.                                             | Open the file from the source link, or Alt+click the element.                                            |
| Alt+click opening the wrong editor, or none                | `launch-editor` picked another editor, or found none.                                                                                       | Set `LAUNCH_EDITOR` (for example `code`, `cursor`, `webstorm`) in the environment of `lumiose dev`.      |
| Matching a dev page's raw HTML exactly in end-to-end tests | In `lumiose dev`, elements that render a box carry `data-lumiose-source`, so `<h1 id=user>` no longer matches. Builds and Vitest have none. | Allow extra attributes (`/<h1 id=user[^>]*>/`), select elements by role and text, or test the built app. |

## Markdown and HTML imports in detail

Both are opt-in options of the Vite plugin. A `.md` or `.html` file in your project then imports
as a component that renders the file's content. The build compiles it into a static template,
like any `.stsx` markup, so it costs a clone in the browser and a string on the server. It works
the same in `static`, `server` and `spa` routes and inside islands.

> **Trusted files only.** An import is part of your app's code. Its raw HTML, inline handlers
> and, in `.html`, scripts reach the page as written, and nothing sanitizes them at runtime.
> Never fill a `.md` or `.html` import with end-user content (comments, profiles, input from a
> CMS that untrusted people edit): render such content as text in a component. The compiler
> still escapes an inline SVG's `<style>` text and limits nesting depth, but that is defence in
> depth, not a sanitizer.

**Markdown** is plain CommonMark with the GitHub extensions: tables, strikethrough, task lists,
autolinks (`www.example.com`, bare URLs) and footnotes. There is no MDX: Markdown cannot use
components or JS expressions. Raw HTML is allowed, since the file is part of your project, and
follows the HTML rules that follow, except for `<script>`: Markdown is content only, so a `<script>`
fails the build ([LUM1008](../errors/LUM1008.md)). Put scripts in an `.html` import or a
component.

- **Heading ids.** Each heading gets a GitHub-style id from its text: `## Hello, World!` becomes
  `id="hello-world"`, and repeats get `-1`, `-2`. A heading written as raw HTML with its own `id`
  keeps it.
- **Frontmatter.** A leading block between `---` lines is YAML (1.2 core schema: dates stay
  strings). The module exports it as `frontmatter`: plain data, `{}` without a block, typed
  `Frontmatter` (any keys, `unknown` values). Lumiose has no schema conventions. To validate or transform it at build time, pass a hook:
  `lumiose({ md: { frontmatter(data, { file }) { …; return data } } })`. What the hook returns is
  exported (returning `undefined` keeps `data`), and it may be async. A hook that throws fails the
  build with the file's name. Values may be JSON data, `Date`, `URL`, `Map`, `Set`, `BigInt`,
  `undefined` or `RegExp`.
- **Headings list.** The module also exports `headings`: each heading's `depth` (1 to 6), `text`
  and `id`, in document order, raw HTML headings included. The ids are the rendered anchors', so
  a table of contents links with `#${id}`. A heading whose text has no slug (`## !!!`) has no id
  and is not listed.
- **Code blocks** render as `<pre><code class="language-js">`, without highlighting.

**HTML** files are parsed the way a browser parses them.

- **Documents and fragments.** A full document (a doctype, or an `<html>`, `<head>` or `<body>`
  tag) contributes the content of its `<body>`, plus the `<style>` elements and scripts of its
  `<head>`. The rest of the head (`<title>`, `<meta>`, `<link>`) is dropped. Anything else is a
  fragment and is used as it is. The root `index.html` and other HTML entries of Vite, and files in
  `public/`, are never components.
- **Styles.** A top-level `<style>` is scoped to the file's content, like a top-level block in a
  `.stsx` file, and `<style global>` is not scoped. A `<style>` nested inside an element scopes to
  that element's subtree, as in `.stsx`. A `<style>` inside `<template>` (a web component's shadow
  DOM) or `<svg>` is left as it is. `$name` references are not available: there is no JS scope.
- **Scripts.** `<script>` and `<script type="module">` run as client modules: bundled by Vite and
  loaded in the browser on the pages that render the component, as a
  [`?client` script](../concepts/islands.md#concept) is, without the island runtime. Inline scripts and `src`
  files are both bundled. A relative `src` is resolved against the HTML file.
  Classic scripts become modules too, so they are deferred and strict. Scripts with other types
  (`application/ld+json`, `importmap`) stay in the markup.
- **Templates.** A `<template>`'s content stays verbatim, unscoped. So does the content of
  `<noscript>`. Comments and the doctype are dropped.
- **Attributes** are kept as written, including inline handlers (`onclick="…"`) and names JSX
  cannot write (`@click`, `x-on:click.prevent`), which are passed through a spread.
- **Asset URLs.** Relative URLs in `<img src>` and `srcset`, `<source src>` and `srcset`,
  `<video src>` and `poster`, `<audio src>`, `<track src>`, and `<a href>` to a file (an extension
  other than `.html` or `.md`) are bundled. They resolve against the `.md` or `.html` file, as
  `import url from "./photo.jpg?url"` does in a `.stsx` module: Vite serves them in dev and
  fingerprints them in builds (`/assets/photo-[hash].jpg`, or a data URL under its inline limit).
  Markdown images and links render as these elements, so their relative URLs are bundled too.
  Absolute paths (`/logo.svg`, from `public/`), URLs with a scheme or a query, fragments (`#top`)
  and links to pages (`./about`, `./next.md`) are kept as written. A missing file fails the
  build.

Raw `<style>` in Markdown follows the same rules. Raw `<script>` in Markdown is an error, with
the file and line ([LUM1008](../errors/LUM1008.md)); scripts belong in `.html` imports.

**How scripts load.** A file's scripts take the path of a [`?client` import](../concepts/islands.md#concept)
("Scripts of server-rendered components"). A server-rendered page that renders the component gets
one `<script type="module" async>` for them, in the `<head>` or with the streamed chunk of the
`<Suspense>` boundary that rendered it. There is no island: a page with no islands loads that
script and no island runtime. The scripts run once per page however many times the component
renders. In a client render (in an island or an SPA page), they load with the component's module.
A `src` file runs for its side effects even in a package with `"sideEffects": false`. An edit to
such a file reloads the page in dev, since scripts such as `customElements.define` cannot run
twice. An `.html` component takes no props: for a script that needs data from the server, render
the element from a `.stsx` component with a `?client` script, and pass the data in attributes
([Web components](../guides/web-components.md#server-data-in-attributes)).

> **Status:** available in `lumiose dev` and builds, with HMR: an edit re-renders the content and
> hot-updates its CSS. The dev server follows Vite's
> [`server.fs.allow`](https://vite.dev/config/server-options.html#server-fs-allow): the browser
> gets the modules of files inside it, or of files the app imports, and a 403 for any other file.

**A web component in one `.html` file.** Its shadow styles stay in its template; its light-DOM rule is scoped to the file.

```html
<!-- src/components/user-card.html: a web component in one file -->
<template id="user-card">
  <style>
    :host {
      display: block;
    }
  </style>
  <slot></slot>
</template>
<user-card>Ada Lovelace</user-card>
<script type="module">
  customElements.define(
    "user-card",
    class extends HTMLElement {
      connectedCallback() {
        const template = document.getElementById("user-card");
        this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
      }
    },
  );
</script>
<style>
  user-card {
    margin-block: 1rem;
  }
</style>
```

**Mistakes with Markdown and HTML imports.**

- **Forgetting the option.** `.md` and `.html` imports are off by default; without
  `lumiose({ md: true })` Vite tries to read the file as JavaScript.
- **Trusting frontmatter types without a check.** `frontmatter` has `unknown` values. Declare
  fields in `Frontmatter` ([example](../concepts/content.md#example)) only when the hook validates the data.
- **Styling Markdown from a scoped block without `:deep()`.** The rendered elements belong to the
  Markdown component. Use `:deep()`, a class on a wrapper plus `:deep()`, or a `<style>` in the
  `.md` file itself.
- **Targeting `body` or `html` from an HTML file's `<style>`.** Its top-level styles are scoped
  to the file's content (`LUM3005`: the selector matches no element). Use `<style global>`.
- **A `<script>` in Markdown.** It fails with [LUM1008](../errors/LUM1008.md). Move the markup
  and script to an `.html` file and import that, or render the Markdown next to an island.
- **Expecting a script per use.** A file's scripts run once per page, not once per rendered
  component. Query the elements they work on (`document.querySelectorAll`) or use a custom
  element, which runs its code for every instance.
- **Linking to a file that is not there.** A relative asset URL (`<img src="./photo.jpg">`) is an import:
  a typo or a missing file fails the build. Files meant to be served as they are belong in
  `public/`, with an absolute URL (`/downloads/app.zip`).
- **Relative links between pages.** A Markdown link to `./next-post` is kept as written, so it resolves
  against the page's URL, not the file's. Link to the route's URL instead (`/blog/next-post`).
