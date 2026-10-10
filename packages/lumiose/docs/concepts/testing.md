# Testing

> Test components with Vitest through the Lumiose Vite plugin: mount into a DOM environment, interact, call `flushSync()`, assert. Test server rendering with `renderToString`.

## Concept

Vitest uses your Vite config, so `lumiose()` compiles `.stsx` and `.tsx` test subjects the same way
as the app. Two things matter for component tests:

- **A DOM environment.** Use `happy-dom` (or `jsdom`), per file with
  `// @vitest-environment happy-dom` or for all tests with `test.environment`.
- **The browser build of `lumiose`.** `lumiose` has a browser entry (signals, the DOM renderer) and a
  `node` entry (server rendering, where signals are plain values and effects never run). Vitest
  resolves Node conditions, but `lumiose()` gives tests in a DOM environment the browser entry of
  `lumiose`, so mounted components update. Tests without a DOM environment keep the `node` entry.

Updates are batched: after a write or an event outside a delegated handler, call `flushSync()`
before asserting. Delegated events (`onClick`) need the element to be attached to `document`.

Server rendering is tested with `renderToString(() => <Page />)` under the `node` entry: a test
file without a DOM environment, in the same project.

> **Status:** `@lumiose/testing` (a `render()` helper and Testing Library integration) is planned.
> Until then, use `mount` from `lumiose/dom` as shown here.

## API

| API                                                  | Use                                         |
| ---------------------------------------------------- | ------------------------------------------- |
| `mount(() => <App />, container)` from `lumiose/dom` | Render into a DOM node; returns a disposer. |
| `flushSync()`                                        | Run pending bindings and effects now.       |
| `renderToString(() => <App />)`                      | Server-render to a string (node entry).     |

## Example

```ts
// vitest.config.ts
import lumiose from "lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
  test: { environment: "happy-dom" },
});
```

```tsx check file=Counter.test.tsx
// src/Counter.test.tsx
import { flushSync } from "lumiose";
import { mount } from "lumiose/dom";
import { expect, it } from "vitest";
import { Counter } from "./Counter.stsx";

it("counts clicks", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(() => <Counter start={2} />, container);

  const button = container.querySelector("button")!;
  button.click();
  flushSync();

  expect(button.textContent).toContain("Clicked 3 times");
  dispose();
  container.remove();
});
```

## Common mistakes

- **No DOM environment.** Without `happy-dom` (or `jsdom`) there is no `document`, and `lumiose`
  resolves to its `node` entry, which has no reactive graph: set the environment for component
  tests.
- **Asserting right after a write.** Effects and bindings run in a microtask; call `flushSync()`
  first.
- **Clicking a detached element.** Delegated handlers listen at `document`; append the container
  to `document.body`.
- **Not disposing.** Call the disposer returned by `mount` so effects and listeners from one test
  do not leak into the next.
- **Testing server components in a DOM environment.** Async server components that use
  `request()`, `cookies()` or `*.server.ts` modules belong in server-side tests with
  `renderToString`.

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph (also `renderToString` called with the browser entry).
- [LUM4004](../errors/LUM4004.md): browser API at module scope.

See also: [Getting started](../getting-started.md), [reference: `lumiose/dom`](../reference/dom.md), [reference: server](../reference/server.md).
