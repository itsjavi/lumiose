# Getting started

> Set up a Lumiose project with TypeScript and Vite 8, write a first `.stsx` component and check it with `lumiose check`.

## Requirements

- Node.js 24 or later.
- TypeScript (`typescript@^7`). Lumiose uses stock `tsc`, with no TypeScript plugins.
- Vite 8.

## Create a project

```sh
pnpm create lumiose my-app --template ssr   # or: minimal, static, spa
cd my-app && pnpm install && pnpm dev
```

| Template  | `lumiose({ mode })` | What you get                                                 |
| --------- | ------------------- | ------------------------------------------------------------ |
| `minimal` | `static`            | One page.                                                    |
| `static`  | `static`            | A layout, pages, a blog with `staticPaths()` and a 404 page. |
| `ssr`     | `server`            | Streaming, a form action, a JSON endpoint and a Node server. |
| `spa`     | `spa`               | Pages and a persistent layout rendered in the browser.       |

Every template also sets `lumiose({ csp: "strict" })`, so new projects start with a strict Content
Security Policy: nonces on pages rendered per request, hashes on prerendered ones, and no inline
scripts or styles that Lumiose did not write ([Security](concepts/security.md)). Remove the option
to turn it off; projects set up by hand, as below, start without it.

Every project starts agent-ready: `AGENTS.md` (with a Lumiose section pointing at these docs),
`CLAUDE.md` referencing it, the `lumiose` skill in `.claude/skills/lumiose`, and `.gitattributes`
highlighting `.stsx` as TSX. In an existing project, `lumiose agents init` writes the same files
(re-run it after upgrading Lumiose; it only touches its own parts). With `--mcp`, both also register
the [Lumiose MCP server](reference/mcp.md) for Claude Code (`.mcp.json`) and Codex
(`.codex/config.toml`). Run `create-lumiose --help` for the options (`--yes`, `--force`, `--mcp`,
`--format json`).

The rest of this page sets a project up by hand, step by step.

## 1. Install

```sh
pnpm add lumiose
pnpm add -D @lumiose/vite @lumiose/cli vite typescript
```

Every Lumiose package shares one version. A project starts with three:

- `lumiose`: the runtime your app imports (signals, the DOM and server renderers, the router, the
  app runtime). It has no dependencies.
- `@lumiose/vite`: the Vite plugin, plus the dev server and the production build behind
  `lumiose dev` and `lumiose build`.
- `@lumiose/cli`: the `lumiose` command (`dev`, `build`, `preview`, `check`, `lint`, `fmt`, `docs`,
  `mcp`, …).

`@lumiose/compiler` (the native compiler) comes with them. Add
[`@lumiose/adapter-node`](reference/adapter-node.md) to preview a build (`lumiose preview`) and to
serve it on Node in production.

## 2. Configure TypeScript

`tsconfig.json` extends the tsconfig that Lumiose generates (`lumiose check` prints this file when it
is missing, and `lumiose agents init` writes it):

```jsonc
{
  // Lumiose's compiler options, shadow TSX and route types. lumiose dev, build, check and typegen
  // write the generated file; add your own options below.
  "extends": "./.lumiose/tsconfig.generated.json",
}
```

- `.lumiose/tsconfig.generated.json` sets `jsx: "preserve"` (the Lumiose compiler transforms JSX, not
  TypeScript), `jsxImportSource: "lumiose"`, bundler module resolution, `strict`, `types:
  ["lumiose/env"]`, and the `rootDirs` and `include` entries below. Lumiose keeps it current.
- `.lumiose/shadow`: TypeScript cannot read `.stsx`, so Lumiose writes a masked copy of each one (a
  _shadow file_, same line and column offsets) and `import "./X.stsx"` resolves to it.
- `.lumiose/types`: generated route types (`lumiose typegen`, run by `lumiose check`).
- `lumiose dev`, `build`, `check` and `typegen` write `.lumiose/`. Before a bare `tsc` in a fresh
  clone, run `lumiose typegen`. See [tsconfig](./reference/jsx.md#tsconfigjson).

Add `.lumiose/` to `.gitignore`, and `*.stsx linguist-language=TSX` to `.gitattributes` so GitHub
highlights `.stsx` files.

## 3. Configure Vite

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
});
```

## 4. Write a component

```stsx check file=Counter.stsx
// src/Counter.stsx
import { signal } from "lumiose";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);

  return (
    <button class={{ hot: count() > 5 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}

<style>
  button { font: inherit; padding: 0.5rem 1rem; }
  .hot { color: crimson; }
</style>
```

- The function body runs **once**. `count()` reads the signal; JSX that reads it updates on its own.
- The `<style>` block at the end of the file is scoped to this file: it styles the components
  defined here, and nothing else. One block per file, after the components, is the convention;
  [Styles](./concepts/styles.md) covers blocks nested in JSX.

## 5. Mount it

```html
<!-- index.html -->
<div id="app"></div>
<script type="module" src="/src/main.tsx"></script>
```

```tsx check file=main.tsx
// src/main.tsx
import { render } from "lumiose/dom";
import { Counter } from "./Counter.stsx";

render(() => <Counter start={1} />, document.getElementById("app")!);
```

Run `pnpm vite` and open the printed URL.

## 6. Check the project

```sh
pnpm lumiose check        # typegen + shadow files + tsc + Lumiose diagnostics
pnpm lumiose lint         # oxlint, .stsx included
pnpm lumiose fmt          # oxfmt for the TSX, plus each <style> block
```

`lumiose check` maps every TypeScript error in a shadow file back to the `.stsx` line and column.
`--format json` prints machine-readable diagnostics; every Lumiose diagnostic has a stable code that
`lumiose explain <code>` explains.

## Editor

Install the Lumiose VS Code extension (`lumiose-vscode`). It adds the `stsx` language and runs the
Lumiose language server, which proxies TypeScript for `.ts`, `.tsx` and `.stsx` files and adds:

- CSS features inside `<style>` blocks;
- class completion, definitions and rename that follow placement: the blocks enclosing the
  cursor (never a sibling subtree's), the file's, and the project's global classes (`<style global>`
  blocks and imported global `.css` files);
- `var(--…)` completion of every custom property declared in the project, with its value;
- descriptions of `<style global>` and of Lumiose attributes (`client:*`, `bind:*`, `on:*`, `attach`,
  `ref`, `key`), and the snippets `comp`, `acomp`, `route` and `island`;
- the compiler's diagnostics, with the project-wide ones (`LUM4003` server-only imports in the
  client graph, `LUM3012` unread custom properties) that follow the other files' edits;
- hovers on JSX expressions with their execution contract: tracked (re-runs when the signals it
  reads change, which it lists), once, untracked or deferred, and the runtime helper that runs it.

The extension bundles the server (it runs on VS Code's own Node.js) and uses the project's
`typescript`; install `@lumiose/language-server` as a dev dependency only to pin the server to your
`lumiose` version. See [Compiler and diagnostics](concepts/compiler.md). Neovim and Helix run the
same server: [Editors](guides/editors.md).

## Next

- [Components](concepts/components.md) and [Signals](concepts/signals.md): the component model.
- [Styles](concepts/styles.md): scoping by placement, JS values in styles and build-time math.
- [Rendering modes](concepts/rendering-modes.md): server-first pages with islands.
