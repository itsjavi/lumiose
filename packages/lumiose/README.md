<p align="center">
  <img src="https://itsjavi.com/lumiose/favicon.svg" width="96" height="96" alt="Lumiose logo: a violet-to-amber glowing sphere">
</p>

<h1 align="center">Lumiose</h1>

<p align="center">
  <strong>Feels like React. Runs like vanilla JS.</strong><br>
  A web framework for everything from static sites and SPAs to full-stack apps: TSX with scoped CSS built in,
  signals, and 0&nbsp;kB of JavaScript until a page needs it.
</p>

<p align="center">
  <a href="https://itsjavi.com/lumiose/">Website</a> ·
  <a href="https://itsjavi.com/lumiose/docs/getting-started/">Get started</a> ·
  <a href="https://itsjavi.com/lumiose/playground/">Playground</a> ·
  <a href="https://itsjavi.com/lumiose/benchmarks/">Benchmarks</a> ·
  <a href="https://github.com/itsjavi/lumiose">GitHub</a>
</p>

## Quick start

```sh
npm create lumiose@latest my-app
```

Pick a template (`minimal`, `static`, `ssr` or `spa`), then `pnpm dev`. Lumiose is pre-1.0, so APIs
may still change between minor versions.

## A component

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

`Counter` runs once. Clicking updates only the text and the class that read `count()`: the compiler
turns components into direct DOM updates, with no virtual DOM.

## What's in the box

- **TSX with scoped CSS.** `.stsx` files are JSX plus raw-CSS `<style>` blocks, type-checked by stock
  `tsc`.
- **Signals, not re-renders.** `signal`, `computed`, `effect` and `store` update exactly the DOM
  nodes that use them.
- **Every rendering mode, per route.** Static, server (streamed), islands and SPA, with the same
  components in all four.
- **The full stack.** File routes, layouts, async components, form actions that work without
  JavaScript, endpoints, middleware, i18n and a strict Content Security Policy.
- **Content as components.** `.md`, `.html` and `.svg?component` imports.
- **Deploy anywhere.** Node, Docker, Cloudflare Workers, Vercel, Netlify, Bun, Deno and static
  hosts.

## Packages

| Package                                                          | What it does                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `lumiose`                                                        | The runtime: signals, components, the DOM and server renderers |
| [`@lumiose/vite`](https://www.npmjs.com/package/@lumiose/vite)   | The Vite plugin: compiler, dev server and build                |
| [`@lumiose/cli`](https://www.npmjs.com/package/@lumiose/cli)     | The `lumiose` command: dev, build, check, docs and MCP         |
| [`create-lumiose`](https://www.npmjs.com/package/create-lumiose) | Project templates                                              |
| `@lumiose/adapter-*`                                             | Node, Cloudflare, Vercel and Netlify deploy adapters           |

## Documentation

The docs ship inside this package, so they always match the installed version: read them in
`node_modules/lumiose/docs`, from the terminal with `lumiose docs`, or on the
[website](https://itsjavi.com/lumiose/docs/). Coming from React, Next.js, React Router or Solid? Start
with the [Coming from](https://itsjavi.com/lumiose/docs/coming-from/react/) guides.

## Stability

Lumiose is 0.x: any minor release may break the API. The
[Stability](https://itsjavi.com/lumiose/docs/stability/) page has the 1.0 criteria, the supported
Node.js versions and browsers, and who maintains Lumiose; [When not to use
Lumiose](https://itsjavi.com/lumiose/docs/when-not-to-use/) names the cases where another framework
fits better.

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
