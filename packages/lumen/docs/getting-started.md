# Getting started

> Set up a Lumen project with TypeScript 7 and Vite 8, write a first `.stsx` component and check it with `lumen check`.

## Requirements

- Node.js 24 or later.
- TypeScript 7 (`typescript@^7`). Lumen uses stock `tsc`, with no TypeScript plugins.
- Vite 8.

## Create a project

```sh
pnpm create lumen my-app --template ssr   # or: minimal, static, spa
cd my-app && pnpm install && pnpm dev
```

| Template  | `lumen({ mode })` | What you get                                                 |
| --------- | ----------------- | ------------------------------------------------------------ |
| `minimal` | `static`          | One page.                                                    |
| `static`  | `static`          | A layout, pages, a blog with `staticPaths()` and a 404 page. |
| `ssr`     | `server`          | Streaming, a form action, a JSON endpoint and a Node server. |
| `spa`     | `spa`             | Pages and a persistent layout rendered in the browser.       |

Every project starts agent-ready: `AGENTS.md` (with a Lumen section pointing at these docs),
`CLAUDE.md` referencing it, the `lumen` skill in `.claude/skills/lumen`, and `.gitattributes`
highlighting `.stsx` as TSX. In an existing project, `lumen agents init` writes the same files
(re-run it after upgrading Lumen; it only touches its own parts). Run `create-lumen --help` for the
options (`--yes`, `--force`, `--format json`).

The rest of this page sets a project up by hand, step by step.

## 1. Install

```sh
pnpm add lumen
pnpm add -D vite typescript
```

## 2. Configure TypeScript

`tsconfig.json` (the template that `lumen check` prints when the file is missing):

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumen",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "rootDirs": ["src", ".lumen/shadow/src"],
    "types": ["lumen/env"]
  },
  "include": ["src", ".lumen/shadow", ".lumen/types"]
}
```

- `jsx: "preserve"`: the Lumen compiler transforms JSX, not TypeScript.
- `rootDirs` and `.lumen/shadow`: TypeScript cannot read `.stsx`, so Lumen writes a masked copy of
  each one (a _shadow file_, same line and column offsets) and `import "./X.stsx"` resolves to it.
- `.lumen/types`: generated route types (`lumen typegen`, run by `lumen check`).

Add `.lumen/` to `.gitignore`, and `*.stsx linguist-language=TSX` to `.gitattributes` so GitHub
highlights `.stsx` files.

## 3. Configure Vite

```ts
// vite.config.ts
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen()],
});
```

## 4. Write a component

```stsx check file=Counter.stsx
// src/Counter.stsx
import { signal } from "lumen";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);

  return (
    <button class={{ hot: count() > 5 }} onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times

      <style>
        button { font: inherit; padding: 0.5rem 1rem; }
        .hot { color: crimson; }
      </style>
    </button>
  );
}
```

- The function body runs **once**. `count()` reads the signal; JSX that reads it updates on its own.
- `<style>` inside the component's JSX is scoped to that component's elements.

## 5. Mount it

```html
<!-- index.html -->
<div id="app"></div>
<script type="module" src="/src/main.tsx"></script>
```

```tsx check file=main.tsx
// src/main.tsx
import { mount } from "lumen/dom";
import { Counter } from "./Counter.stsx";

mount(() => <Counter start={1} />, document.getElementById("app")!);
```

Run `pnpm vite` and open the printed URL.

## 6. Check the project

```sh
pnpm lumen check        # typegen + shadow files + tsc + Lumen diagnostics
pnpm lumen lint         # oxlint, .stsx included
pnpm lumen fmt          # oxfmt for the TSX, plus each <style> block
```

`lumen check` maps every TypeScript error in a shadow file back to the `.stsx` line and column.
`--format json` prints machine-readable diagnostics; every Lumen diagnostic has a stable code that
`lumen explain <code>` explains.

## Editor

Install the Lumen VS Code extension (`lumen-vscode`). It adds the `stsx` language and runs the
Lumen language server, which proxies TypeScript 7 for `.ts`, `.tsx` and `.stsx` files and adds:

- CSS features inside `<style>` blocks;
- class completion, definitions and rename that follow placement: the blocks enclosing the
  cursor (never a sibling subtree's), the file's, and the project's global classes (`<style global>`
  blocks and imported global `.css` files);
- `var(--…)` completion of every custom property declared in the project, with its value;
- descriptions of `<style global>` and of Lumen attributes (`client:*`, `bind:*`, `on:*`, `attach`,
  `ref`, `key`), and the snippets `comp`, `acomp`, `route` and `island`;
- the compiler's diagnostics.

The extension bundles the server (it runs on VS Code's own Node.js) and uses the project's
`typescript`; install `@lumen/language-server` as a dev dependency only to pin the server to your
`lumen` version. See [Compiler and diagnostics](concepts/compiler.md).

## Next

- [Components](concepts/components.md) and [Signals](concepts/signals.md): the component model.
- [Styles](concepts/styles.md): scoping by placement, JS values in styles and build-time math.
- [Rendering modes](concepts/rendering-modes.md): server-first pages with islands.
