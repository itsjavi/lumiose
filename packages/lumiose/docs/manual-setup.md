# Manual setup

> Add Lumiose to a project by hand: install the packages, configure TypeScript and Vite, write a component and mount it. Also what `create-lumiose` sets up for you.

Most projects start from a template ([Getting started](getting-started.md)). Set a project up by
hand to add Lumiose to an existing Vite project, or to see what each file is for. Check the
[requirements](requirements.md) first.

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

`tsconfig.json` extends the tsconfig that Lumiose generates. `lumiose check` prints this file when
it is missing, and `lumiose agents init` writes it.

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

Add the plugin. Its options: [`@lumiose/vite`](reference/vite.md).

```ts
// vite.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
});
```

## 4. Write a component

The function body runs **once**. `count()` reads the signal; JSX that reads it updates on its own.

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

The `<style>` block at the end of the file is scoped to this file: it styles the components
defined here, and nothing else. One block per file, after the components, is the convention;
[Styles](./concepts/styles.md) covers blocks nested in JSX.

## 5. Mount it

`render` mounts a component into an element of `index.html`.

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

Run `pnpm vite` and open the printed URL. Then check the project:
[Getting started, step 4](getting-started.md#4-check-it).

## What create-lumiose sets up

The templates do the steps above, and add:

- **A strict Content Security Policy.** Every template sets `lumiose({ csp: "strict" })`: nonces
  on pages rendered per request, hashes on prerendered ones, and no inline scripts or styles that
  Lumiose did not write ([Security](concepts/security.md)). Remove the option to turn it off;
  projects set up by hand, as above, start without it.
- **Agent files.** Every project starts agent-ready: `AGENTS.md` (with a Lumiose section pointing
  at these docs), `CLAUDE.md` referencing it, the `lumiose` skill in `.claude/skills/lumiose`, and
  `.gitattributes` highlighting `.stsx` as TSX. In an existing project,
  [`lumiose agents init`](reference/cli.md#lumiose-agents-init) writes the same files (re-run it
  after upgrading Lumiose; it only touches its own parts).
- **The MCP server, with `--mcp`.** Both `create-lumiose` and `lumiose agents init` then register
  the [Lumiose MCP server](reference/mcp.md) for Claude Code (`.mcp.json`) and Codex
  (`.codex/config.toml`).

Run `create-lumiose --help` for the options (`--yes`, `--force`, `--mcp`, `--format json`).

> **Status:** `create-lumiose` will also offer `@lumiose/ui`, the accessible and unstyled UI
> components, with a question and `--ui`, once that package is on npm: it adds the dependency,
> imports its stylesheet and default theme in the root layout, and adds its agent files (a UI part
> in `AGENTS.md` and the `lumiose-ui` skill). In a project that already depends on it,
> `lumiose agents init` adds those agent files.
