# Markdown and HTML imports

> Import Markdown and HTML files as components, compiled at build time, with frontmatter, heading lists, scoped styles and client scripts.

## Concept

### Import a Markdown file

Turn the option on, and a `.md` file imports as a component, with its `frontmatter` and its
`headings` list. The build compiles it into a static template, in every rendering mode.

```ts check
// vite.config.ts
import { defineConfig } from "vite";
import lumiose from "@lumiose/vite";

export default defineConfig({
  plugins: [lumiose({ md: true, html: true })],
});
```

```md file=posts/hello.md
---
title: Hello
---

Plain **CommonMark** with the GitHub extensions.
```

```stsx check file=routes/post/page.stsx
import Hello, { frontmatter } from "../../posts/hello.md";

export default function Page() {
  return (
    <article class="post">
      <h1>{String(frontmatter.title)}</h1>
      <Hello />
      <style>
        .post :deep(p) { max-width: 60ch; }
      </style>
    </article>
  );
}
```

### Import an HTML file

An `.html` file imports the same way. Its top-level `<style>` is scoped to the file, and its
`<script>` runs as a client module, once per page.

```html file=components/clock.html
<time class="clock"></time>
<script type="module">
  const clock = document.querySelector(".clock");
  clock.textContent = new Date().toLocaleTimeString();
</script>
<style>
  .clock {
    font-variant-numeric: tabular-nums;
  }
</style>
```

> **Trusted files only.** An import is part of your app's code: nothing sanitizes it at runtime.
> Never fill a `.md` or `.html` import with end-user content.

> **Details:** the Markdown and HTML rules (heading ids, frontmatter, styles, scripts, asset
> URLs), a web component in one file, and the status:
> [Markdown and HTML imports in detail](../reference/vite.md#markdown-and-html-imports-in-detail).

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

A frontmatter hook validates every post at build time, a declaration gives the fields their
types, and the blog page lists the posts with the latest one's table of contents.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import lumiose from "@lumiose/vite";
import * as z from "zod";

const Post = z.object({
  title: z.string(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});

export default defineConfig({
  plugins: [
    lumiose({
      md: { frontmatter: (data) => Post.parse(data) },
    }),
  ],
});
```

```ts file=content.d.ts
declare module "*.md" {
  interface Frontmatter {
    title: string;
    date: Date;
    draft: boolean;
  }
}
```

```stsx file=routes/blog/page.stsx
import type { Frontmatter, Heading } from "*.md";

type Post = {
  default: () => JSX.Element;
  frontmatter: Frontmatter;
  headings: ReadonlyArray<Heading>;
};
// `import.meta.glob` is Vite's (types from `vite/client`).
const posts = Object.values(
  import.meta.glob<Post>("../../posts/*.md", { eager: true }),
).toSorted(
  (a, b) =>
    b.frontmatter.date.getTime() - a.frontmatter.date.getTime(),
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

## Common mistakes

Each in full:
[Markdown and HTML imports in detail](../reference/vite.md#markdown-and-html-imports-in-detail).

- **Forgetting the option.** `.md` and `.html` imports are off by default.
- **Trusting frontmatter types without a check.** Values are `unknown` unless a hook validates.
- **Styling Markdown without `:deep()`.** Its elements belong to the Markdown component.
- **Targeting `body` or `html` from an HTML file's `<style>`** (`LUM3005`). Use `<style global>`.
- **A `<script>` in Markdown** fails the build (`LUM1008`). Use an `.html` import.
- **Expecting a script per use.** A file's scripts run once per page.
- **A relative asset URL to a missing file** fails the build; served files belong in `public/`.
- **Relative links between pages** resolve against the page's URL. Link to the route's URL.

## Related diagnostics

The generated component compiles like a `.stsx` file, so style diagnostics apply to its blocks,
for example [LUM3005](../errors/LUM3005.md) for a selector that matches nothing.
[LUM1008](../errors/LUM1008.md) reports a `<script>` in a Markdown file. A frontmatter
block that is not a mapping, or a hook that throws, fails the build with the file's name.

See also: [Styles](styles.md), [Islands](islands.md), [SVG imports](svg.md), [reference: `@lumiose/vite`](../reference/vite.md), [reference: JSX types](../reference/jsx.md).
