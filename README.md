<p align="center">
  <img src="apps/web/public/favicon.svg" width="96" height="96" alt="Lumiose logo: a violet-to-amber glowing sphere">
</p>

<h1 align="center">Lumiose</h1>

<p align="center">
  <strong>Feels like React. Runs like vanilla JS.</strong><br>
  A web framework for everything from static sites and SPAs to full-stack apps: TSX with scoped CSS built in,
  signals, and 0&nbsp;kB of JavaScript until a page needs it.
</p>

<p align="center">
  <a href="https://itsjavi.com/lumiose/">Website</a> ·
  <a href="https://itsjavi.com/lumiose/docs/getting-started">Get started</a> ·
  <a href="https://itsjavi.com/lumiose/playground">Playground</a> ·
  <a href="https://itsjavi.com/lumiose/showcase">Showcase</a> ·
  <a href="https://itsjavi.com/lumiose/benchmarks">Benchmarks</a> ·
  <a href="LICENSE">MIT License</a>
</p>

<table align="center">
  <tr>
    <td align="center"><strong>0 kB</strong><br><sub>JavaScript on server-rendered pages</sub></td>
    <td align="center"><strong>1.08×</strong><br><sub>vanilla JS on js-framework-benchmark</sub></td>
    <td align="center"><strong>6.4 kB</strong><br><sub>runtime and app, compressed</sub></td>
  </tr>
</table>

## Quick start

```bash
npm create lumiose@latest my-app
```

Pick a template (`minimal`, `static`, `ssr` or `spa`), then `pnpm dev`. Every new project starts agent-ready, with an
`AGENTS.md` and a Lumiose skill. Lumiose is pre-1.0, so APIs may still change between minor versions.

## Why Lumiose

Most stacks make you assemble the pieces: a UI library, a styling solution, a meta-framework on top, and for content
sites, a second UI framework for anything interactive.

Lumiose is one framework for all of it. You write components the way you already do in React, with their styles in the
same file. Each route picks how it renders, from static HTML to a full SPA, and a page ships no JavaScript until it has
something interactive. The compiler, written in Rust, turns components into direct DOM updates, with no virtual DOM.

```tsx
import { signal } from "lumiose";

const accent = "#5546ff";

export default function Counter() {
  const count = signal(0);

  return (
    <button class={{ pill: true, hot: count() > 9 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}

// One <style> block scoped to this file, with JS values like $accent.
<style>
  .pill {
    padding: 8px 16px;
    border: 0;
    border-radius: 999px;
    background: $accent;
    color: white;
  }
  .hot {
    outline: 2px solid tomato;
  }
</style>
```

`Counter` runs once. Clicking updates only the text and the class that read `count()`. Try it in the
[playground](https://itsjavi.com/lumiose/playground), which runs the compiler in your browser.

## Features

- **TSX with scoped CSS.** `.stsx` files are JSX plus raw-CSS `<style>` blocks, scoped by where you put them, with JS
  values (`$name`) and build-time math. Stock `tsc` type-checks them, with no TypeScript plugins.
- **Signals, not re-renders.** `signal`, `computed`, `effect` and `store` update exactly the DOM nodes that use them.
  The rules of hooks, dependency arrays, stale closures and memoization go away.
- **Every rendering mode, per route.** Static (prerendered HTML), server (streamed: the shell first, then each
  `<Suspense>` boundary), islands (`client:load`, `client:idle`, `client:visible`) and SPA (client routing with a
  prerendered first paint). The same components work in all four.
- **The full stack, built in.** File routes with layouts and a typed `href()`, async components, form actions that
  work without JavaScript, endpoints, middleware, cookies, i18n, and a strict Content Security Policy with nonces.
- **Content as components.** Import `.md` and `.html` files (GFM, front matter) and SVGs (optimised and inlined) as
  components.
- **Deploy anywhere.** Node, Docker, Cloudflare Workers, Vercel, Netlify, Bun, Deno, Fly.io, Render, Railway, AWS
  Lambda or any static host, each with a [deploy guide](https://itsjavi.com/lumiose/docs/deploy).
- **Explicit, for you and your agent.** Client boundaries are where you write them. Every diagnostic has a `LUMxxxx`
  code, a fix and a docs page. The docs ship inside the package (`lumiose docs signals`) and are served to agents over
  MCP.
- **Tooling included.** The `lumiose` CLI (dev, build, preview, check, lint, fmt), a language server and VS Code
  extension, oxlint/ESLint and Prettier plugins, and TanStack Query bindings in `@lumiose/query`.

## How it compares

| Stack              | Styles         | JS on a server page | Client speed | SSR renders/s | Requests/s |
| ------------------ | -------------- | ------------------: | -----------: | ------------: | ---------: |
| **Lumiose**        | **Built in**   |            **0 kB** |    **1.08×** |       **619** |  **1,323** |
| React + Next.js    | Pick a library |              119 kB |        1.54× |           185 |        437 |
| React Router       | Pick a library |              101 kB |        1.54× |           185 |        683 |
| Preact             | Pick a library |                   — |        1.52× |           208 |          — |
| Astro              | Built in       |                0 kB |           —¹ |           206 |      1,247 |
| Svelte + SvelteKit | Built in       |               38 kB |        1.17× |           505 |      1,067 |
| Vue + Nuxt         | Built in       |               76 kB |        1.25× |           204 |        608 |
| Solid + SolidStart | Pick a library |               33 kB |        1.11× |           580 |        999 |
| Remix 3            | Built in       |               42 kB |        1.57× |            44 |        823 |

<sub>
Measured on 2026-10-12 (Apple M1 Max, Node 26.8.1). <b>JS on a server page</b>: what the same issue tracker loads for
its home page, brotli. <b>Client speed</b>: js-framework-benchmark's weighted factor, where 1.00 is vanilla JS.
<b>SSR renders/s</b>: a 5,000-component page rendered to an HTML string. <b>Requests/s</b>: the issue tracker's home
page. Preact has no full-stack layer. ¹ Astro's interactive islands need a second UI framework. Method and every run:
<a href="https://itsjavi.com/lumiose/benchmarks">benchmarks</a>.
</sub>

## Showcase

<table>
  <tr>
    <td width="50%"><a href="https://itsjavi.com/lumiose/showcase/chiptune-tracker/"><img src="apps/web/public/showcase/chiptune-tracker.png" alt="Lumiose Chip: a dark, pixel-font chiptune tracker with a pattern grid of notes across four channels, an order list, instruments and a mixer."></a></td>
    <td width="50%"><a href="https://itsjavi.com/lumiose/showcase/dotmatrix/"><img src="apps/web/public/showcase/dotmatrix.png" alt="Dotmatrix: a Game Boy-style chiptune studio with four channel cards, a green piano roll and sound presets."></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://itsjavi.com/lumiose/showcase/chiptune-tracker/">Lumiose Chip</a>: a chiptune tracker (SPA)</td>
    <td align="center"><a href="https://itsjavi.com/lumiose/showcase/dotmatrix/">Dotmatrix</a>: a pocket chiptune studio (SPA)</td>
  </tr>
  <tr>
    <td width="50%"><a href="https://itsjavi.com/lumiose/demos/travel-journal/"><img src="apps/web/public/showcase/travel-journal.png" alt="Long Way Round: a travel journal home page with a serif headline, a search box and a featured post illustrated with a moonlit city."></a></td>
    <td width="50%"><a href="examples/ssr-bookshelf"><img src="apps/web/public/showcase/bookshelf.png" alt="Bookshelf: a book catalogue home page with a search box, sign-in links and a row of recommended books with star ratings."></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://itsjavi.com/lumiose/demos/travel-journal/">Long Way Round</a>: a travel journal (static + islands)</td>
    <td align="center"><a href="examples/ssr-bookshelf">Bookshelf</a>: a book catalogue (server)</td>
  </tr>
</table>

The [website](https://itsjavi.com/lumiose/) itself is a static Lumiose site, with islands for the search, the
playground and the landing page's light.

## Documentation

The docs live in [`packages/lumiose/docs/`](packages/lumiose/docs/) and ship with the package, so they always match
the installed version. Read them on the [website](https://itsjavi.com/lumiose/docs/getting-started), from the terminal
with `lumiose docs`, or through [`llms.txt`](https://itsjavi.com/lumiose/llms.txt). Good places to start:
[Getting started](https://itsjavi.com/lumiose/docs/getting-started),
[Coming from React](https://itsjavi.com/lumiose/docs/coming-from-react) and
[Rendering modes](https://itsjavi.com/lumiose/docs/concepts/rendering-modes).

## Working on Lumiose

You need Node 24 or later, pnpm and Rust (`rustup` installs the toolchain in `rust-toolchain.toml` on first use).

```bash
git clone https://github.com/itsjavi/lumiose.git
cd lumiose
pnpm install
pnpm build:compiler   # the Rust compiler, as a native Node addon
pnpm demo             # pick an example, the website or a benchmark app and start it
```

`pnpm check` runs what CI runs. [CONTRIBUTING.md](CONTRIBUTING.md) covers the demo runner, building the website, CI,
the compiler binaries and releases.

| Folder                      | What's in it                                                         |
| --------------------------- | -------------------------------------------------------------------- |
| [`packages/`](packages)     | The framework, the Vite plugin, the CLI, adapters and editor tooling |
| [`crates/`](crates)         | The Rust compiler, with its CSS, SVG and content pipelines           |
| [`apps/web/`](apps/web)     | The website: landing page, docs, showcase, benchmarks and playground |
| [`examples/`](examples)     | Example apps for every rendering mode                                |
| [`benchmarks/`](benchmarks) | js-framework-benchmark, SSR and the fullstack comparison             |

## License

[MIT](LICENSE). This covers the Lumiose packages, the website and all examples, except code vendored with its own
notice: the gbapu Game Boy APU engine in `examples/spa-dotmatrix/vendor/gbapu` (by the same author, MIT release
planned) and the Remix 3 benchmark entry (Apache-2.0).
