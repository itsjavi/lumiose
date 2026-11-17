# Getting started

> Create a Lumiose project, write a first `.stsx` component, style it and check it with `lumiose check`.

## 1. Create a project

```sh
pnpm create lumiose my-app --template ssr
cd my-app && pnpm install && pnpm dev
```

Pick a template, then open the URL that `pnpm dev` prints. The rendering mode can change later
([Rendering modes](concepts/rendering-modes.md)).

| Template  | `lumiose({ mode })` | What you get                                                 |
| --------- | ------------------- | ------------------------------------------------------------ |
| `minimal` | `static`            | One page.                                                    |
| `static`  | `static`            | A layout, pages, a blog with `staticPaths()` and a 404 page. |
| `ssr`     | `server`            | Streaming, a form action, a JSON endpoint and a Node server. |
| `spa`     | `spa`               | Pages and a persistent layout rendered in the browser.       |

> **Requirements:** Node.js 24, TypeScript 7 and Vite 8. Platforms and the WebAssembly fallback:
> [Requirements](requirements.md).

> **By hand:** to add Lumiose to an existing Vite project, and for what the templates set up
> (a strict CSP, agent files, the MCP server): [Manual setup](manual-setup.md).

## 2. Write a component

A component is a function, and its body runs **once**. State is a signal: `count()` reads it,
`count.update()` writes it, and the JSX that reads it updates on its own.

```stsx check file=components/Counter.stsx
// src/components/Counter.stsx
import { signal } from "lumiose";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);

  return (
    <button onClick={() => count.update((n) => n + 1)}>
      Clicked {count()} times
    </button>
  );
}
```

```stsx check file=routes/hello/page.stsx
// src/routes/hello/page.stsx
import { Counter } from "../../components/Counter.stsx";

export default function Hello() {
  return <Counter client:load start={1} />;
}
```

Each folder in `src/routes` with a `page.stsx` is a page: open `/hello` and click. Pages ship no
JavaScript by default, so `client:load` makes the counter an [island](concepts/islands.md) that
runs in the browser.

```text
Clicked 2 times
```

## 3. Style it

Add one `<style>` block at the end of the file. It is plain CSS, scoped to this file: `button`
matches the buttons written here, and nothing else.

```stsx check
// src/components/Counter.stsx
import { signal } from "lumiose";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);

  return (
    <button
      class={{ hot: count() > 5 }}
      onClick={() => count.update((n) => n + 1)}
    >
      Clicked {count()} times
    </button>
  );
}

<style>
  button { font: inherit; padding: 0.5rem 1rem; }
  .hot { color: crimson; }
</style>
```

After five clicks the text turns crimson. More in [Styles](concepts/styles.md).

## 4. Check it

```sh
pnpm lumiose check   # types and Lumiose diagnostics
pnpm lumiose lint    # oxlint, .stsx included
pnpm lumiose fmt     # oxfmt, <style> blocks included
```

```text
No problems found.
```

`lumiose check` runs typegen, writes the shadow files, runs `tsc` and adds Lumiose's diagnostics.
It maps every TypeScript error back to the `.stsx` line and column. `--format json`
prints machine-readable diagnostics, and `lumiose explain <code>` explains any Lumiose diagnostic
by its stable code ([CLI](reference/cli.md)).

## Editor

Install the Lumiose VS Code extension (`lumiose.lumiose-vscode`) from the Marketplace: search for
Lumiose in the Extensions view, or run `code --install-extension lumiose.lumiose-vscode`. What it
adds, and Cursor, VSCodium, Neovim and Helix: [Editors](guides/editors.md#vs-code).

## Next

- [Components](concepts/components.md) and [Signals](concepts/signals.md): the component model.
- [Styles](concepts/styles.md): scoping by placement, JS values in styles and build-time math.
- [Rendering modes](concepts/rendering-modes.md): server-first pages with islands.
