# Coming from Astro

> Lumiose keeps Astro's page model, server HTML with no JavaScript by default and `client:*` islands with the same directive names, and swaps `.astro` files plus a second UI framework for one component model: TSX components that render on the server, become islands where you use them, or run as SPA routes. This guide maps the APIs and says where Astro is still ahead.

This page maps Astro 7 to Lumiose's current API. The linked pages have the full rules.

## Mental model

**The same page model.** As in Astro, pages render to HTML at build time or per request, and a
page ships no JavaScript until something on it needs some. A `client:*` directive at the usage
site makes one component instance an [island](../concepts/islands.md), with Astro's directive
names. File routes, layouts, endpoints, middleware, Markdown imports and deploy adapters all have a
counterpart below.

**One component model instead of two.** In Astro, `.astro` components render on the server only,
and anything interactive is written in React, Preact, Svelte, Vue or Solid. Moving a piece of UI
from one side to the other means rewriting it. In Lumiose every component is TSX, in a `.stsx` file
(TSX plus `<style>` blocks) or a `.tsx` file, set up once and updated by
[signals](../concepts/signals.md):

- **The same component works on both sides.** It renders as static HTML on one page and as an
  island on another (`<Search client:idle />`), with no rewrite.
- **Islands can await data.** An island may `await` data like a server component. The values are
  recorded while rendering on the server and replayed during hydration.
- **Islands share state without a store library.** They share it through
  [`defineState`](../concepts/state.md#state-shared-by-islands-definestate), seeded on the
  server, instead of Nano Stores.
- **A route can become an SPA.** Set it to `spa` and it gets client navigation with persistent
  layouts, using the same components ([Rendering modes](../concepts/rendering-modes.md)).

**Typed client scripts.** Astro bundles `<script>` tags as TypeScript, but server values only reach
them through `define:vars` (which makes the script inline and untyped) or `data-*` attributes read
by hand. In Lumiose, a component imports a browser script with `?client`, and only the pages that
render that component load it, without the island runtime. Server data goes through the attributes
of a custom element whose props are typed in JSX ([the example](#example) shows both).

**Styles live in the component file**, as in Astro, with raw CSS in `<style>` blocks. They are
scoped by where the block is placed: at the top level of the file, or nested inside an element to
scope one subtree ([Styles](../concepts/styles.md)).

**Where Astro is ahead today.** Be clear about these before you switch:

- **Islands in React, Vue or Svelte**, or several frameworks on one page. Lumiose has one component
  model and no React interop ([When not to use Lumiose](../when-not-to-use.md)).
- **The integrations ecosystem.** `astro add` installs sitemaps, RSS, MDX, image services and CMS
  loaders. In Lumiose a sitemap or an RSS feed is a short `route.ts` endpoint you write, and some
  pieces have no counterpart yet (see [What has no equivalent](#what-has-no-equivalent)).
- **Content collections and `<Image>`.** Lumiose imports Markdown as components with validated
  frontmatter, but it has no collections API or image pipeline.
- **Requests for small scripts.** Astro inlines a small `<script>` into the HTML. A `?client`
  script is a module file of its own, so a page with a few of them makes a few more requests. A
  Lumiose page with an island also loads the island runtime, about 10 kB gzip: use `?client` for
  small scripts and keep islands for reactive UI.
- **Maturity.** Astro is past 1.0, with a team behind it. Lumiose is 0.x, with one maintainer
  ([Stability](../stability.md)).

**What a real port showed.** The author's Astro site, itsjavi.com, was ported to Lumiose 0.5.0
with the same URLs and look, its small scripts as `?client` custom elements, and measured on
2026-10-21:

- JavaScript per page was 1.7-2.4 kB gzip, against 1.3-1.7 kB for Astro's inline scripts, and every
  page but the code editor was lighter in total, with 2 to 4 more requests.
- Type checking took 1.2 s with `lumiose check`, against 5.8 s with `astro check`.
- A fresh install had 175 packages, against 433.
- Per-page CSS was 30-50% smaller than the site's Tailwind build.
- Builds were on par (4.7 s cold, 2.2 s warm, against 4.3 s and 2.3 s); the dev server's first
  start was slower (4.7 s against 2.0 s).

## From Astro to Lumiose

### Components and templates

| Astro                                                     | Lumiose                                                                                                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `.astro` file: frontmatter fence plus template            | `.stsx` (TSX plus `<style>`) or `.tsx`: a function whose body runs once as setup, then returns JSX ([Components](../concepts/components.md)). |
| `Astro.props`, `interface Props`                          | The component's one props parameter, typed inline: `({ title }: { title: string })`. Destructuring stays reactive.                            |
| `<slot />`                                                | `{props.children}`, inserted once.                                                                                                            |
| Named slots, `<slot name="footer" />`                     | Props that hold JSX: `footer={<p>…</p>}`.                                                                                                     |
| `Astro.slots.render("default", [args])`                   | A render-function prop: `row={(item) => <li>{item.name}</li>}`.                                                                               |
| `class:list={["a", { b: on }]}`                           | `class={["a", { b: on }]}`: strings, arrays and objects.                                                                                      |
| `set:html={html}`, `set:text={text}`                      | `innerHTML={html}` on an element; text children, or `textContent`.                                                                            |
| `<Fragment>`, `<>…</>`                                    | `<>…</>`. `<Fragment set:html>` needs a real element with `innerHTML`.                                                                        |
| `{items.map((item) => <li>{item}</li>)}`, `{cond && <p>}` | The same; on the client the compiler turns `.map()` into a keyed list and `&&` into a branch ([JSX](../concepts/jsx.md)).                     |

### Styles and scripts

| Astro                               | Lumiose                                                                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<style>` (scoped to the component) | A `<style>` block, scoped by placement: file level, or nested in an element for its subtree ([Styles](../concepts/styles.md)).                                                                                             |
| `<style is:global>`, `:global(.x)`  | `<style global>`, `:global(.x)`; `:deep(.x)` reaches into child components and Markdown.                                                                                                                                   |
| `<style define:vars={{ accent }}>`  | `style={{ "--accent": color() }}` plus `var(--accent)` for a value that changes; `$accent` for a constant that JS also uses or a breakpoint, inlined at build time ([Design tokens](../concepts/styles.md#design-tokens)). |
| `<script>` (bundled, TypeScript)    | `import init from "./init.ts?client"` and `init()` while rendering: the pages that render the component load the script, without the island runtime ([Islands](../concepts/islands.md)).                                   |
| `<script define:vars={{ id }}>`     | Attributes on a custom element, typed in `JSX.IntrinsicElements` and read in `connectedCallback` ([Web components](../guides/web-components.md)).                                                                          |
| `<script is:inline>`                | A JSX `<script>`: its text is written as is ([JSX](../concepts/jsx.md)).                                                                                                                                                   |
| Tailwind integration                | The Tailwind v4 Vite plugin works as in any Vite app ([Styles](../concepts/styles.md#stylesheets-css-modules-and-tailwind)).                                                                                               |

### Islands

| Astro                                                        | Lumiose                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Counter client:load />` (a React, Svelte… component)       | `<Counter client:load />`, where `Counter` is a Lumiose component that may also render without a directive.                                                                     |
| `client:idle`, `client:idle={{ timeout: 500 }}`              | `client:idle`, which hydrates at the latest after 2 s. No timeout option.                                                                                                       |
| `client:visible`, `client:visible={{ rootMargin: "200px" }}` | `client:visible`, `client:visible="200px"`.                                                                                                                                     |
| `client:media="(max-width: 50em)"`                           | The same.                                                                                                                                                                       |
| `client:only="react"`                                        | `client:only`, with no framework name.                                                                                                                                          |
| Island props (serializable)                                  | The same rule, checked at build time ([LUM4002](../errors/LUM4002.md)); the island component must be exported ([LUM4001](../errors/LUM4001.md)).                                |
| Nano Stores between islands                                  | `defineState(factory)`: one instance per page, seeded on the server ([Sharing state](../concepts/state.md#state-shared-by-islands-definestate)).                                |
| `server:defer`                                               | No server islands. A `server` page streams slow parts in the same response with `<Suspense>` ([Rendering modes](../concepts/rendering-modes.md#close-to-partial-prerendering)). |
| `<astro-island>` wrapper element                             | Comment markers, so flex, grid and child selectors see the island's own elements ([details](../concepts/rendering-modes.md#compared-with-astro-islands)).                       |

### Routing and pages

| Astro                                                    | Lumiose                                                                                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/index.astro`, `about.astro`                   | `src/routes/page.stsx`, `about/page.stsx`: a folder is a URL segment ([Routing](../concepts/routing.md)).                                                                                            |
| `blog/[slug].astro`                                      | `blog/[slug]/page.stsx`.                                                                                                                                                                             |
| `[...slug].astro` (zero or more segments)                | `[[...slug]]`. Lumiose's `[...slug]` matches one or more.                                                                                                                                            |
| Layout components with `<slot />`, imported by each page | `layout.stsx` in a folder wraps every page below it, nested automatically; `props.children` is the outlet.                                                                                           |
| `getStaticPaths()` with `params` and `props`             | `staticPaths()` returns `[{ params }]`; the page loads its data from `params`.                                                                                                                       |
| `Astro.params`                                           | `params` in `PageProps<"/blog/[slug]">`, or `params()`.                                                                                                                                              |
| `output: "static"`, `"server"`, `export const prerender` | `lumiose({ mode })` (default `"static"`), and `export const mode = "static" \| "server" \| "spa"` per route or layout ([Rendering modes](../concepts/rendering-modes.md#granularity-and-combining)). |
| `src/pages/404.astro`, `500.astro`                       | `not-found.stsx` and `error.stsx`; the nearest one wins. A `static` build writes `404.html`.                                                                                                         |
| `<ClientRouter />`, `transition:persist`                 | An `spa` route with [`lumiose/router`](../reference/router.md), whose layouts persist; or `lumiose({ viewTransitions: true })` for cross-document transitions between MPA pages.                     |
| `prefetch`                                               | On by default (on hover, through speculation rules); `<Link prefetch>` in `spa` routes.                                                                                                              |
| `i18n` routing, `getRelativeLocaleUrl()`                 | `lumiose({ i18n: { locales, defaultLocale } })`, `href("/about", { locale })` and `export const locales` per page ([i18n](../concepts/i18n.md)).                                                     |

### Server, endpoints and actions

| Astro                                                 | Lumiose                                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/api/feed.json.ts` exporting `GET(context)` | `src/routes/api/feed.json/route.ts`: `export const GET: Endpoint<"/api/feed.json"> = (ctx) => Response`. Static builds accept only `GET`.                                                              |
| `src/middleware.ts`: `onRequest`, `sequence()`        | `src/middleware.ts`: a default export `(ctx, next) => Response`, or an array; a `middleware.ts` in a route folder for its routes ([Server](../concepts/server.md)).                                    |
| `Astro.locals`, `context.locals`                      | `ctx.locals` in middleware, endpoints and actions; `locals()` while rendering. Type it by augmenting `Locals`.                                                                                         |
| `Astro.request`, `Astro.url`, `Astro.cookies`         | `request()`, `url()` and `cookies()` during a `server` render ([reference](../reference/app.md#request-apis-server)).                                                                                  |
| `return Astro.redirect("/login")`                     | `redirect("/login")`, which throws.                                                                                                                                                                    |
| `Astro.response.status`, `.headers`                   | `response().setStatus(404)`, `response().setHeader(name, value)`, before the page starts streaming.                                                                                                    |
| Astro Actions: `defineAction({ input, handler })`     | Form actions on the page: `export const actions = { save(ctx) {…} }` and `<form method="post" action="?/save">`, which works without JavaScript ([Data and actions](../concepts/data-and-actions.md)). |
| `input: z.object(…)` on an action                     | Validate inside the action and return `fail(400, { errors })`; `actionData()` reads the result.                                                                                                        |
| `import.meta.env.PUBLIC_*`                            | The same for client code; `env("NAME")` on the server.                                                                                                                                                 |
| `security.csp` (Astro's CSP option)                   | `lumiose({ csp: "strict" })`: a nonce per response, hashes on prerendered pages ([Security](../concepts/security.md)).                                                                                 |

### Content

| Astro                                                 | Lumiose                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.md` pages and `import { Content } from "./post.md"` | `import Post, { frontmatter, headings } from "./post.md"` with `lumiose({ md: true })`: the post is a component ([Content](../concepts/content.md)). |
| Collection schemas (`content.config.ts` with zod)     | The `lumiose({ md: { frontmatter } })` hook validates each file at build time; declare the result in `interface Frontmatter`.                        |
| `getCollection("blog")`                               | `import.meta.glob("../posts/*.md", { eager: true })`.                                                                                                |
| `render(entry)` → `<Content />`, `headings`           | The import is the component; `headings` is exported next to it.                                                                                      |
| `.html` components                                    | `import Card from "./card.html"` with `lumiose({ html: true })`.                                                                                     |
| SVG imports as components                             | `import Logo from "./logo.svg?component"`, optimised and inlined ([SVG](../concepts/svg.md)).                                                        |

### Config, CLI and deploy

| Astro                                              | Lumiose                                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `astro.config.mjs`                                 | `vite.config.ts` with the `lumiose()` plugin from `@lumiose/vite` ([reference](../reference/vite.md)).                                                            |
| `astro dev`, `build`, `preview`, `check`           | `lumiose dev`, `build`, `preview`, `check`; also `routes`, `lint` and `fmt` ([CLI](../reference/cli.md)).                                                         |
| `<head>` in a layout, `<title>`                    | `<Title>`, `<Meta>` and `<Head>` from any component, and `src/document.stsx` for the document ([Head and document](../concepts/head.md)).                         |
| `@astrojs/node`, `vercel`, `netlify`, `cloudflare` | `@lumiose/adapter-node`, or `lumiose({ adapter })` for Vercel, Netlify and Cloudflare; a fully static site deploys `dist/client` ([Deploy](../deploy/README.md)). |
| Integrations (`astro add`)                         | Vite plugins, and Lumiose packages that ship `.stsx` components ([reference](../reference/vite.md#lumiose-packages)).                                             |

## What has no equivalent

| Astro                                                 | Instead                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| React, Vue, Svelte or Solid islands; `@astrojs/react` | None: one component model, no framework integrations. Use web components or framework-agnostic libraries for third-party widgets.       |
| `<Image>`, `<Picture>`, `astro:assets`                | None yet. An image import gives a fingerprinted URL for a plain `<img>`; Vite image plugins work.                                       |
| Content collections: loaders, `getEntry`, references  | `import.meta.glob` over Markdown files, plus your own helpers on top.                                                                   |
| MDX                                                   | None: Markdown is content only (a `<script>` in it is [LUM1008](../errors/LUM1008.md)). Put components in the page around the Markdown. |
| `@astrojs/sitemap`, `@astrojs/rss`                    | A `route.ts` endpoint that returns the XML; static builds write it as a file.                                                           |
| `redirects` in the config                             | `redirect()` in a page (a static build writes a redirect page) or in middleware.                                                        |
| `server:defer` on prerendered pages                   | An island that fetches an endpoint, or a `server` page with `<Suspense>`.                                                               |

## Example

A header with a search box as a React island, a theme toggle in a bundled `<script>`, and scoped
styles, in Astro:

```astro
---
// src/components/Header.astro
import Search from "./Search.tsx"; // React, only for this island
const { title } = Astro.props;
---
<header>
  <a href="/">{title}</a>
  <Search client:idle placeholder="Search posts" />
  <button type="button" data-theme-toggle data-storage-key="theme">Theme</button>
</header>

<script>
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
  const key = button.dataset.storageKey!; // untyped: a typo here is a runtime bug
  button.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    localStorage.setItem(key, dark ? "dark" : "light");
  });
</script>

<style>
  header { display: flex; gap: 1rem; align-items: center; }
</style>
```

In Lumiose, the search box is a Lumiose component, which could render without a directive on
another page. The theme toggle is a typed browser script that only the pages rendering the header
load. Its data goes through a typed attribute:

```ts check file=components/theme-toggle.ts
// src/components/theme-toggle.ts: runs in the browser only
customElements.define(
  "theme-toggle",
  class extends HTMLElement {
    connectedCallback(): void {
      const key = this.getAttribute("storage-key") ?? "theme";
      this.addEventListener("click", () => {
        const dark = document.documentElement.classList.toggle("dark");
        localStorage.setItem(key, dark ? "dark" : "light");
      });
    }
  },
);
```

```stsx check file=components/Search.stsx
// src/components/Search.stsx
import { signal } from "lumiose";

export function Search({ placeholder }: { placeholder: string }) {
  const query = signal("");
  return (
    <form role="search" action="/search">
      <input name="q" placeholder={placeholder} bind:value={query} />
      {query() && <p>Press Enter to search for "{query()}".</p>}
    </form>
  );
}
```

```stsx check file=components/Header.stsx
// src/components/Header.stsx
import { Search } from "./Search.stsx";
import defineThemeToggle from "./theme-toggle.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      // The server side is type-checked; the script reads the attribute with getAttribute().
      "theme-toggle": JSX.HTMLProps<HTMLElement> & { "storage-key"?: string };
    }
  }
}

export function Header({ title }: { title: string }) {
  defineThemeToggle();
  return (
    <header>
      <a href="/">{title}</a>
      <Search client:idle placeholder="Search posts" />
      <theme-toggle storage-key="theme">
        <button type="button">Theme</button>
      </theme-toggle>
    </header>
  );
}

<style>
  header { display: flex; gap: 1rem; align-items: center; }
</style>
```

A blog post page built from a collection, in Astro:

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, render } from "astro:content";
import Layout from "../../layouts/Layout.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
<Layout title={post.data.title}>
  <article><Content /></article>
</Layout>
```

In Lumiose, the Markdown files are imported as components. `staticPaths()` lists the slugs, and
the page looks its post up from `params`. `src/routes/layout.stsx` wraps it without an import:

```stsx
// src/routes/blog/[slug]/page.stsx
import type { Frontmatter } from "*.md";
import { Title, notFound, type PageProps } from "lumiose";

type Post = { default: () => JSX.Element; frontmatter: Frontmatter };
const modules = import.meta.glob<Post>("../../../posts/*.md", { eager: true });
const posts = new Map(
  Object.entries(modules).map(([path, post]) => [path.split("/").pop()!.replace(/\.md$/, ""), post]),
);

export function staticPaths() {
  return [...posts.keys()].map((slug) => ({ params: { slug } }));
}

export default function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const { default: Content, frontmatter } = posts.get(params.slug) ?? notFound();
  return (
    <article>
      <Title>{frontmatter.title}</Title>
      <Content />
    </article>
  );
}
```

## Common mistakes

- **Writing frontmatter.** There is no `---` fence: imports go at the top of the module, and setup
  code goes in the component's body.
- **`[...slug]` for an optional catch-all.** It matches one or more segments in Lumiose. Astro's
  `[...slug]` is `[[...slug]]`.
- **Importing a layout into every page.** A `layout.stsx` in the folder wraps its pages already, so
  importing it as well renders it twice.
- **An interactive component without `client:*`.** It renders on the server, and its handlers never
  run. Add a directive at the usage site, or make the route `spa`.
- **A `<script>` tag for a component's behaviour.** A JSX `<script>` is written into the HTML as is,
  untyped and unbundled. Import a `.ts` file with `?client` instead.
- **Passing props through `staticPaths()`.** It returns `params` only; load the data in the page.
- **`Astro.redirect()` habits.** `redirect()` throws, so code after it does not run, and request
  APIs such as `cookies()` need a `server` page
  ([LUM5001](../errors/LUM5001.md)).
- **Expecting page context inside an island.** Islands start a new root, so context provided by the
  page does not reach them ([LUM4010](../errors/LUM4010.md)). Pass a prop, or use `defineState`.

## Related

- [Islands](../concepts/islands.md) and [Rendering modes](../concepts/rendering-modes.md): what ships to the browser, and how Lumiose islands compare with Astro's.
- [Components](../concepts/components.md) and [JSX](../concepts/jsx.md): setup once, props, children and the compiled template.
- [Styles](../concepts/styles.md): `<style>` blocks scoped by placement, and `$name` values.
- [Content](../concepts/content.md): Markdown and HTML imports, frontmatter and headings.
- [Web components](../guides/web-components.md): typed custom elements, the home of typed `?client` scripts.
- [Routing](../concepts/routing.md), [Server](../concepts/server.md) and [Data and actions](../concepts/data-and-actions.md): pages, middleware, endpoints and form actions.
- [When not to use Lumiose](../when-not-to-use.md): the cases where another stack fits better.
