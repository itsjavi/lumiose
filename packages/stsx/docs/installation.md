# Installation

> Add `@lumiose/stsx` to a Vite app before your framework's plugin, set `classAttribute` for the framework, and point the tsconfig at the shadow files so that `tsc` checks `.stsx` files.

```sh
pnpm add -D @lumiose/stsx
```

It needs Vite 8 and Node 24 or later. The plugin goes **before** the framework's plugin: it turns
each `.stsx` file into TSX for that plugin, and its `<style>` blocks into a stylesheet for Vite.

In dev, the browser gets the `.stsx` files inside
[`server.fs.allow`](https://vite.dev/config/server-options#server-fs-allow), and those your app's
modules import (a linked package's), as Vite does for its own files. Requests for others get
Vite's 403.

## React

```ts
// vite.config.ts
import react from "@vitejs/plugin-react";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stsx({ classAttribute: "className" }), react()],
});
```

Fast Refresh works as with `.tsx` files. An edit inside a `<style>` block replaces the stylesheet
alone, without re-rendering.

## React Router

```ts
// vite.config.ts
import { reactRouter } from "@react-router/dev/vite";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stsx({ classAttribute: "className" }), reactRouter()],
});
```

Route modules stay `.tsx` files and render components from `.stsx` files: see
[React Router](react-router.md).

## Solid

```ts
// vite.config.ts
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [stsx({ classAttribute: "class" }), solid()],
});
```

Solid compiles the scope markers into its static templates, so they cost nothing at runtime.
Elements that Solid creates later (in `<For>`, `<Show>`) carry them too.

## TypeScript

Add the shadow directory to `rootDirs` and `include`, so that `import "./Card.stsx"` type-checks:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDirs": [".", ".lumiose/stsx"],
  },
  "include": ["src", ".lumiose/stsx"],
}
```

Add `.lumiose/` to `.gitignore`, and run `stsx typegen` before `tsc` in CI. Editors, other
directories and the details: [Type checking and editors](type-checking.md).

## Your first component

Rename a component file from `.tsx` to `.stsx` and add a `<style>` block next to the elements it
styles:

```tsx
// Card.stsx
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="card">
      <style>
        .card { padding: 1rem; border-radius: 12px; background: #f4f4f5; }
        h2 { margin: 0 0 0.5rem; }
      </style>
      <h2>{title}</h2>
      {children}
    </article>
  );
}
```

Imports of `./Card.stsx` work like imports of `./Card.tsx`. The rules of the blocks: [Styles](styles.md).
