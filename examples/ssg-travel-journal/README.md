# Long Way Round: a static Lumiose site

A travel journal built from Markdown files and prerendered by `lumiose build` into plain HTML, CSS
and a little JavaScript. It deploys to any static host: `dist/client` is the whole site.

It shows Lumiose's `static` mode with dynamic routes (`staticPaths()`), static `GET` endpoints for
the RSS feed, the sitemap and a search index, global and scoped styles with `$tokens`, two islands
and cross-document View Transitions.

![The journal's home page](../../backlog/assets/task-37-home.png)

## Run it

```sh
pnpm --filter @lumiose-examples/ssg-travel-journal dev        # lumiose dev on :5173
pnpm --filter @lumiose-examples/ssg-travel-journal build      # lumiose build: dist/client
pnpm --filter @lumiose-examples/ssg-travel-journal serve      # serve.ts: dist/client on :4321, as plain files
pnpm --filter @lumiose-examples/ssg-travel-journal typecheck  # lumiose check: .ts and .stsx
pnpm --filter @lumiose-examples/ssg-travel-journal test       # Vitest: the content layer, pagination, search
pnpm --filter @lumiose-examples/ssg-travel-journal test:e2e   # Playwright, against the build served by serve.ts
```

`serve.ts` is a tiny static file server that behaves like a typical static host (`/about` serves
`about/index.html`, unknown paths get `404.html` with a 404 status). No Lumiose code runs while it
serves. Every route is prerendered, so `lumiose build` writes no `dist/server`: `dist/client` is
the whole site.

## What is where

```
content/posts/*.md         the posts: YAML frontmatter + Markdown
public/covers/*.svg        cover illustrations (copied to dist/client as they are)
src/
  content.ts               the content layer: the posts as .md imports, sorted, by slug and tag
  frontmatter.ts           frontmatter validation and reading time (the lumiose({ md }) hook)
  posts.d.ts               the frontmatter fields, merged into lumiose/env's Frontmatter
  theme.ts                 design tokens, read by style blocks as $theme.*
  document.tsx             <html>/<head>: RSS link, theme script
  lib/                     site settings, pagination, formatting, the search matcher
  components/              header and footer, post cards, tags, pager, journal page
  islands/                 Search (client:idle) and ThemeToggle (client:load)
  routes/
    layout.stsx            header, footer and <style global>
    page.stsx              /                   journal, page 1
    page/[page]/page.stsx  /page/2, /page/3    staticPaths(); /page/1 redirects to /
    posts/[slug]/page.stsx /posts/<slug>       staticPaths(): one page per post
    tags/page.stsx         /tags
    tags/[tag]/page.stsx   /tags/<tag>         staticPaths(): one page per tag
    archive/page.stsx      /archive            every post by year
    about/page.stsx        /about
    not-found.stsx         → dist/client/404.html
    rss.xml/route.ts       → dist/client/rss.xml
    sitemap.xml/route.ts   → dist/client/sitemap.xml
    search.json/route.ts   → dist/client/search.json
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

The posts are native `.md` imports (`lumiose({ md })` in `vite.config.ts`): each file compiles to a
static component (GitHub-flavored Markdown, headings with ids) whose module also exports its
`frontmatter` and `headings`. The plugin's `frontmatter` hook runs `postFrontmatter()`
(`src/frontmatter.ts`) at build time: it validates the fields and adds the reading time, and
`src/posts.d.ts` declares the result's type. `src/content.ts` loads every post with
`import.meta.glob("../content/posts/*.md", { eager: true })` and gives pages and endpoints a small
API: `allPosts()`, `findPost()`, `adjacentPosts()`, `allTags()`, `postsTagged()`. A post page
renders the body with `<props.post.Content />` and its table of contents from the `##` entries of
`headings`, whose ids are the rendered headings'. The RSS feed renders each body to a string with
`renderToString()`. No Markdown library is involved, and nothing of it reaches the browser.

## Styles

- **Global**: `<style global>` in `routes/layout.stsx`: the page base, `color-scheme` for the
  light and dark themes, focus styles, and the View Transitions opt-in.
- **Scoped**: each file ends with one `<style>` block, shared by the components it defines
  (`Site.stsx` styles both the header and the footer; their selectors start from each one's root
  class so they do not reach each other). The post body is the Markdown file's
  own component, so its elements carry no scope token of the page; `posts/[slug]/page.stsx` styles
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

Pages are ordinary documents linked with `<a href>`. `lumiose({ viewTransitions: true })` in
`vite.config.ts` turns same-origin navigations into cross-document View Transitions in browsers
that support them (not for readers who prefer reduced motion), and each post's cover has a
`view-transition-name` shared by its card and its page, so it morphs into place. Links prefetch
when the pointer rests on them: speculation rules from `lumiose({ prefetch })`, `"hover"` by default.
The pager sets its links apart with `<Link prefetch>` from `lumiose/router`, which renders a plain
`<a>` on these MPA pages: "Newer"/"Older" prefetch early (`"viewport"`), the page numbers never
(`"none"`). Both are progressive: other browsers navigate normally.

## Tests

- `src/content.test.ts`: every post loads and renders, sort order, tags and neighbours, heading
  ids, frontmatter validation.
- `src/lib/lib.test.ts`: pagination, date and XML formatting, the search matcher.
- `e2e/journal.e2e.ts` (Playwright, against `lumiose build` + `serve.ts`): prerendered files and the
  JavaScript a page loads, pagination, prefetch (on hover, and per `<Link prefetch>` in
  Chromium), post pages (table of contents, the Markdown body, the shared
  view-transition name, newer/older links), tags, the archive, 404, both islands (no `LUM4006`
  hydration errors), the RSS feed, the sitemap (every URL resolves), the search index, the site
  without JavaScript and a phone-sized layout. `JOURNAL_SCREENSHOTS=1` also saves the screenshots
  in `backlog/assets/task-37-*.png`.

The posts are written for this sample; the places are real, the journal is made up. The cover
illustrations are generated SVG landscapes.
