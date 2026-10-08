# Markdown and HTML imports

> With `lumen({ md: true, html: true })`, `import Post, { frontmatter } from "./post.md"` and `import Card from "./card.html"` give static components, compiled at build time: CommonMark + GFM with heading ids and YAML frontmatter, or HTML whose `<style>` is scoped to the file and whose `<script>` runs in the browser.

## Concept

Both are opt-in options of the Vite plugin. A `.md` or `.html` file in your project then imports
as a component that renders the file's content. The build compiles it into a static template,
like any `.stsx` markup, so it costs a clone in the browser and a string on the server. It works
the same in `static`, `server` and `spa` routes and inside islands.

**Markdown** is plain CommonMark with the GitHub extensions: tables, strikethrough, task lists,
autolinks (`www.example.com`, bare URLs) and footnotes. There is no MDX: Markdown cannot use
components or JS expressions. Raw HTML is allowed, since the file is part of your project, and
follows the HTML rules below.

- **Heading ids.** Each heading gets a GitHub-style id from its text: `## Hello, World!` becomes
  `id="hello-world"`, and repeats get `-1`, `-2`. A heading written as raw HTML with its own `id`
  keeps it.
- **Frontmatter.** A leading block between `---` lines is YAML (1.2 core schema: dates stay
  strings). The module exports it as `frontmatter`: plain data, `{}` without a block, typed
  `Frontmatter` (any keys, `unknown` values). Lumen has no schema conventions. To validate or transform it at build time, pass a hook:
  `lumen({ md: { frontmatter(data, { file }) { …; return data } } })`. What the hook returns is
  exported (returning `undefined` keeps `data`), and it may be async. A hook that throws fails the
  build with the file's name. Values may be JSON data, `Date`, `URL`, `Map`, `Set`, `BigInt`,
  `undefined` or `RegExp`.
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
  loaded in the browser wherever the component renders, the way an island's module is. Inline
  scripts and `src` files are both bundled. A relative `src` is resolved against the HTML file.
  Classic scripts become modules too, so they are deferred and strict. Scripts with other types
  (`application/ld+json`, `importmap`) stay in the markup.
- **Templates.** A `<template>`'s content stays verbatim, unscoped. So does the content of
  `<noscript>`. Comments and the doctype are dropped.
- **Attributes** are kept as written, including inline handlers (`onclick="…"`) and names JSX
  cannot write (`@click`, `x-on:click.prevent`), which are passed through a spread.

Markdown with raw `<style>` and `<script>` follows the same rules.

**How scripts load.** When a file has scripts, its component also renders an empty island with
`client:load`. On a server-rendered page, the island loader imports the island's module, which
imports the scripts, so they run once per page however many times the component renders. In a
client render, the scripts load with the component's module. An edit to such a file reloads the
page in dev, since scripts such as `customElements.define` cannot run twice.

> **Status:** available in `lumen dev` and builds, with HMR: an edit re-renders the content and
> hot-updates its CSS. Relative `src`/`href` URLs in the markup (`<img src="./photo.jpg">`) are
> not bundled yet: put assets in `public/` or import them from a `.stsx` component.

## API

| Import / option                                      | Gives                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `lumen({ md: true })`                                | Enables `.md` imports                                 |
| `lumen({ md: { frontmatter(data, { file }) {} } })`  | Enables them, with a build-time frontmatter hook      |
| `lumen({ html: true })`                              | Enables `.html` imports                               |
| `import Post, { frontmatter } from "./post.md"`      | `Post: () => JSX.Element`; `frontmatter: Frontmatter` |
| `declare module "*.md" { interface Frontmatter {} }` | Declares the fields your hook guarantees              |
| `import Card from "./card.html"`                     | `Card: () => JSX.Element`                             |
| `import.meta.glob("./posts/*.md", { eager: true })`  | Every post's module (component and frontmatter)       |

The types come with `lumen/env` (`"types": ["lumen/env"]` in `tsconfig.json`).

## Example

```ts
// vite.config.ts: Markdown with validated frontmatter, and HTML imports
import { defineConfig } from "vite";
import lumen from "lumen/vite";
import * as z from "zod";

const Post = z.object({
  title: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});

export default defineConfig({
  plugins: [lumen({ md: { frontmatter: (data) => Post.parse(data) }, html: true })],
});
```

```ts
// src/content.d.ts: the fields the hook guarantees, merged into lumen/env's `Frontmatter`
declare module "*.md" {
  interface Frontmatter {
    title: string;
    date: Date;
    draft: boolean;
  }
}
```

```stsx
// src/routes/blog/index.stsx: a list of posts and the latest one
import type { Frontmatter } from "*.md";

type Post = { default: () => JSX.Element; frontmatter: Frontmatter };
// `import.meta.glob` is Vite's (types from `vite/client`).
const posts = Object.values(import.meta.glob<Post>("../../posts/*.md", { eager: true })).toSorted(
  (a, b) => b.frontmatter.date.getTime() - a.frontmatter.date.getTime(),
);

export default function Blog() {
  const Latest = posts[0]!.default;
  return (
    <main>
      <ul>
        {posts.map((post) => (
          <li>{post.frontmatter.title}</li>
        ))}
      </ul>
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
  `lumen({ md: true })` Vite tries to read the file as JavaScript.
- **Trusting frontmatter types without a check.** `frontmatter` has `unknown` values. Declare
  fields in `Frontmatter` (as above) only when the hook validates the data.
- **Styling Markdown from a scoped block without `:deep()`.** The rendered elements belong to the
  Markdown component. Use `:deep()`, a class on a wrapper plus `:deep()`, or a `<style>` in the
  `.md` file itself.
- **Targeting `body` or `html` from an HTML file's `<style>`.** Its top-level styles are scoped
  to the file's content (`LUM3005`: the selector matches no element). Use `<style global>`.
- **Expecting a script per use.** A file's scripts run once per page, not once per rendered
  component. Query the elements they work on (`document.querySelectorAll`) or use a custom
  element, which runs its code for every instance.
- **Relative asset URLs.** `<img src="./photo.jpg">` is not bundled yet and resolves against the
  page URL. Put the file in `public/` and use an absolute URL.

## Related diagnostics

The generated component compiles like a `.stsx` file, so style diagnostics apply to its blocks,
for example [LUM3005](../errors/LUM3005.md) for a selector that matches nothing. A frontmatter
block that is not a mapping, or a hook that throws, fails the build with the file's name.

See also: [Styles](styles.md), [Islands](islands.md), [SVG imports](svg.md), [reference: `lumen/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
