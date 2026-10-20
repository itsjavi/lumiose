# Markdown and HTML imports

> Import Markdown and HTML files as components, compiled at build time, with frontmatter, heading lists, scoped styles and client scripts.

## Concept

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
follows the HTML rules below, except for `<script>`: Markdown is content only, so a `<script>`
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
  [`?client` script](islands.md#concept) is, without the island runtime. Inline scripts and `src`
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

**How scripts load.** A file's scripts take the path of a [`?client` import](islands.md#concept)
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
> hot-updates its CSS.

## API

| Import / option                                       | Gives                                                 |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `lumiose({ md: true })`                               | Enables `.md` imports                                 |
| `lumiose({ md: { frontmatter(data, { file }) {} } })` | Enables them, with a build-time frontmatter hook      |
| `lumiose({ html: true })`                             | Enables `.html` imports                               |
| `import Post, { frontmatter } from "./post.md"`       | `Post: () => JSX.Element`; `frontmatter: Frontmatter` |
| `import { headings } from "./post.md"`                | `ReadonlyArray<{ depth; text; id }>`, document order  |
| `declare module "*.md" { interface Frontmatter {} }`  | Declares the fields your hook guarantees              |
| `import Card from "./card.html"`                      | `Card: () => JSX.Element`                             |
| `import.meta.glob("./posts/*.md", { eager: true })`   | Every post's module (component and frontmatter)       |

The types come with `lumiose/env` (`"types": ["lumiose/env"]` in `tsconfig.json`).

## Example

```ts
// vite.config.ts: Markdown with validated frontmatter, and HTML imports
import { defineConfig } from "vite";
import lumiose from "@lumiose/vite";
import * as z from "zod";

const Post = z.object({
  title: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});

export default defineConfig({
  plugins: [lumiose({ md: { frontmatter: (data) => Post.parse(data) }, html: true })],
});
```

```ts
// src/content.d.ts: the fields the hook guarantees, merged into lumiose/env's `Frontmatter`
declare module "*.md" {
  interface Frontmatter {
    title: string;
    date: Date;
    draft: boolean;
  }
}
```

```stsx
// src/routes/blog/page.stsx: a list of posts and the latest one, with its table of contents
import type { Frontmatter, Heading } from "*.md";

type Post = {
  default: () => JSX.Element;
  frontmatter: Frontmatter;
  headings: ReadonlyArray<Heading>;
};
// `import.meta.glob` is Vite's (types from `vite/client`).
const posts = Object.values(import.meta.glob<Post>("../../posts/*.md", { eager: true })).toSorted(
  (a, b) => b.frontmatter.date.getTime() - a.frontmatter.date.getTime(),
);

export default function Blog() {
  const { default: Latest, headings } = posts[0]!;
  return (
    <main>
      <ul>
        {posts.map((post) => (
          <li>{post.frontmatter.title}</li>
        ))}
      </ul>
      <nav aria-label="On this page">
        {headings
          .filter((heading) => heading.depth === 2)
          .map((heading) => (
            <a href={`#${heading.id}`}>{heading.text}</a>
          ))}
      </nav>
      <article class="post">
        <Latest />
      </article>
      <style>
        .post :deep(h2) { margin-top: 2rem; }
      </style>
    </main>
  );
}
```

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

The Markdown's elements belong to the post's component, so the route styles them with
`:deep()` under its own `.post` element. The web component's shadow styles stay in its template;
its light-DOM rule is scoped to the file.

## Common mistakes

- **Forgetting the option.** `.md` and `.html` imports are off by default; without
  `lumiose({ md: true })` Vite tries to read the file as JavaScript.
- **Trusting frontmatter types without a check.** `frontmatter` has `unknown` values. Declare
  fields in `Frontmatter` (as above) only when the hook validates the data.
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

## Related diagnostics

The generated component compiles like a `.stsx` file, so style diagnostics apply to its blocks,
for example [LUM3005](../errors/LUM3005.md) for a selector that matches nothing.
[LUM1008](../errors/LUM1008.md) reports a `<script>` in a Markdown file. A frontmatter
block that is not a mapping, or a hook that throws, fails the build with the file's name.

See also: [Styles](styles.md), [Islands](islands.md), [SVG imports](svg.md), [reference: `@lumiose/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
