# Long Way Round: a static Lumen site

A travel journal built from Markdown files and prerendered by `lumen build` into plain HTML, CSS
and a little JavaScript. It deploys to any static host: `dist/client` is the whole site.

It shows Lumen's `static` mode with dynamic routes (`staticPaths()`), static `GET` endpoints for
the RSS feed, the sitemap and a search index, global and scoped styles with `$tokens`, two islands
and cross-document View Transitions.

![The journal's home page](../../backlog/assets/task-37-home.png)

## Run it

```sh
pnpm --filter @lumen-examples/ssg-travel-journal dev        # lumen dev on :5173
pnpm --filter @lumen-examples/ssg-travel-journal build      # lumen build: dist/client
pnpm --filter @lumen-examples/ssg-travel-journal serve      # serve.ts: dist/client on :4321, as plain files
pnpm --filter @lumen-examples/ssg-travel-journal typecheck  # lumen check: .ts and .stsx
pnpm --filter @lumen-examples/ssg-travel-journal test       # Vitest: the content layer, pagination, search
pnpm --filter @lumen-examples/ssg-travel-journal test:e2e   # Playwright, against the build served by serve.ts
```

`serve.ts` is a tiny static file server that behaves like a typical static host (`/about` serves
`about/index.html`, unknown paths get `404.html` with a 404 status). No Lumen code runs while it
serves. `lumen build` also writes `dist/server`, which a static deploy does not need.

## What is where

```
content/posts/*.md         the posts: YAML frontmatter + Markdown
public/covers/*.svg        cover illustrations (copied to dist/client as they are)
src/
  content.ts               the content layer: loads, validates and renders the posts
  theme.ts                 design tokens, read by style blocks as $theme.*
  document.tsx             <html>/<head>: RSS link, theme script
  lib/                     site settings, pagination, formatting, the search matcher
  components/              header and footer, post cards, tags, pager, journal page
  islands/                 Search (client:idle) and ThemeToggle (client:load)
  routes/
    _layout.stsx           header, footer and <style global>
    index.stsx             /                   journal, page 1
    page/[page].stsx       /page/2, /page/3    staticPaths(); /page/1 redirects to /
    posts/[slug].stsx      /posts/<slug>       staticPaths(): one page per post
    tags/index.stsx        /tags
    tags/[tag].stsx        /tags/<tag>         staticPaths(): one page per tag
    archive.stsx           /archive            every post by year
    about.stsx             /about
    _404.stsx              → dist/client/404.html
    rss.xml.ts             → dist/client/rss.xml
    sitemap.xml.ts         → dist/client/sitemap.xml
    search.json.ts         → dist/client/search.json
```

The build prerenders 31 files: 3 journal pages and the `/page/1` redirect page, 10 posts, the
tags page and 10 tag pages, the archive, the about page, the 404 page, the feed, the sitemap and
the search index.

## Content

Each post is a Markdown file whose name is its slug:

```md
---
title: Lofoten in February
date: 2026-02-14
tags: [islands, winter, coast]
summary: Short days, long blue hours, red fishing cabins and the northern lights.
cover: /covers/lofoten-in-february.svg
---

In February the sun barely clears the mountains…
```

All five fields are required; tags are lowercase slugs. A missing or invalid field fails the
build with the file name and the problem.

`src/content.ts` is the only module that knows the posts are Markdown files. It loads them with
`import.meta.glob("../content/posts/*.md", { query: "?raw", import: "default", eager: true })`,
parses the frontmatter with [`yaml`](https://eemeli.org/yaml/) and renders the body with
[`marked`](https://marked.js.org) (GitHub-flavored Markdown, with ids and anchors on headings and
a table of contents from the `##` headings). Pages and endpoints use its small API: `allPosts()`,
`findPost()`, `adjacentPosts()`, `allTags()`, `postsTagged()`. When Lumen supports importing `.md`
files directly (TASK-69), only this file changes. Both libraries run at build time only; they
never reach the browser.

## Styles

- **Global**: `<style global>` in `routes/_layout.stsx`: the page base, `color-scheme` for the
  light and dark themes, focus styles, and the View Transitions opt-in.
- **Scoped**: every component has its own `<style>` block. The post body is HTML from Markdown
  (inserted with `innerHTML`), so its elements carry no scope token; `posts/[slug].stsx` styles
  them from its scoped `.prose` wrapper with `:deep()`.
- **Tokens**: `src/theme.ts` holds colors, fonts, spacing, radii, shadows and breakpoints. Blocks
  read them as `$theme.color.accent` or `@media (width < $theme.layout.narrow)`, and the compiler
  inlines the values. Colors are `light-dark()` pairs, so one token serves both themes.

## Islands

Only two components ship JavaScript; every other part of every page is HTML and CSS.

| Island        | Directive     | What it does                                                                                                                                                                                                                                            |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Search`      | `client:idle` | Searches as you type, over `/search.json` (fetched on first focus). Arrow keys and Enter open a result. Without JavaScript, the form opens the archive, which lists every post.                                                                         |
| `ThemeToggle` | `client:load` | Cycles system → light → dark and stores the choice in `localStorage`. An inline script in `document.tsx` applies it before the first paint. The server renders the "system" state, so hydration matches; without JavaScript the button stays invisible. |

The header passes `url().pathname` (allowed while prerendering, unlike the query string) to mark
the current section.

## Navigation

Pages are ordinary documents linked with `<a href>`. `lumen({ viewTransitions: true })` in
`vite.config.ts` turns same-origin navigations into cross-document View Transitions in browsers
that support them (not for readers who prefer reduced motion), and each post's cover has a
`view-transition-name` shared by its card and its page, so it morphs into place. Links prefetch
when the pointer rests on them: speculation rules from `lumen({ prefetch })`, `"hover"` by default.
Both are progressive: other browsers navigate normally.

## Tests

- `src/content.test.ts`: every post parses, sort order, tags and neighbours, frontmatter
  validation, heading ids.
- `src/lib/lib.test.ts`: pagination, date and XML formatting, the search matcher.
- `e2e/journal.e2e.ts` (Playwright, against `lumen build` + `serve.ts`): prerendered files and the
  JavaScript a page loads, pagination, post pages (table of contents, the Markdown body, the shared
  view-transition name, newer/older links), tags, the archive, 404, both islands (no `LUM4006`
  hydration errors), the RSS feed, the sitemap (every URL resolves), the search index, the site
  without JavaScript and a phone-sized layout. `JOURNAL_SCREENSHOTS=1` also saves the screenshots
  in `backlog/assets/task-37-*.png`.

The posts are written for this sample; the places are real, the journal is made up. The cover
illustrations are generated SVG landscapes.
