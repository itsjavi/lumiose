# `lumen/vite`

> The Vite 8 plugin: compiles `.stsx` and `.tsx` with the Lumen compiler, picks the `lumen` entry per Vite environment, reports diagnostics in the overlay and reloads on edit.

## lumen()

```ts
import lumen from "lumen/vite";

function lumen(options?: LumenOptions): Plugin[];

interface LumenOptions {
  /** Modules compiled by Lumen. Default: .stsx and .tsx files. */
  include?: RegExp;
  /** Modules left to Vite. Default: anything in node_modules. */
  exclude?: RegExp;
}
```

What it does:

- Compiles Lumen modules before Vite's own transform, which is told to skip them. Server consumers
  (SSR) get `lumen/server` code; everything else gets `lumen/dom` code.
- Resolves `lumen` to its `browser` entry in client environments and its `node` entry in server
  environments, and keeps every `lumen` entry out of dependency pre-bundling, so compiled code and
  the runtime share one module instance.
- Turns compiler diagnostics into Vite warnings and errors with code frames (the dev overlay).
- Hot updates: a client module that imports `mount` from `lumen/dom` (an app entry) accepts updates
  of every module it reaches and re-mounts the app into the same container. Component state resets;
  module-level signals of unchanged modules survive.
- Style blocks become `<file>?lumen&type=style&lang.css` modules handled by Vite's CSS pipeline.

> **Status:** compilation, environments, diagnostics and HMR are available. The style-block CSS
> modules are empty until the CSS pipeline lands. The designed app-level options (`adapter`, `css`,
> `csp`, `trailingSlash`, `viewTransitions`, `prefetch`) arrive with `lumen dev` and `lumen build`.
> In Vitest, add `resolve.conditions: ["browser"]` for component tests (see
> [Testing](../concepts/testing.md)).

## Example

```ts
// vite.config.ts
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen({ exclude: /[\\/](node_modules|legacy)[\\/]/ })],
});
```
