# Testing

> Test components with Vitest through the Lumen Vite plugin: mount into a DOM environment, interact, call `flushSync()`, assert. Test server rendering with `renderToString`.

## Concept

Vitest uses your Vite config, so `lumen()` compiles `.stsx` and `.tsx` test subjects the same way
as the app. Two things matter for component tests:

- **A DOM environment.** Use `happy-dom` (or `jsdom`), per file with
  `// @vitest-environment happy-dom` or for all tests with `test.environment`.
- **The browser build of `lumen`.** `lumen` has a browser entry (signals, the DOM renderer) and a
  `node` entry (server rendering, where signals are plain values and effects never run). Vitest
  resolves Node conditions by default, so set `resolve.conditions: ["browser"]` in the config used
  for component tests; otherwise components render once and never update.

Updates are batched: after a write or an event outside a delegated handler, call `flushSync()`
before asserting. Delegated events (`onClick`) need the element to be attached to `document`.

Server rendering is tested with `renderToString(() => <Page />)` under the `node` entry (no DOM
environment, default conditions), for example in a separate Vitest project.

> **Status:** `@lumen/testing` (a `render()` helper and Testing Library integration) is planned.
> Until then, use `mount` from `lumen/dom` as shown here. Making the Vite plugin pick the browser
> entry for DOM test environments automatically is a tracked follow-up.

## API

| API                                                | Use                                                  |
| -------------------------------------------------- | ---------------------------------------------------- |
| `mount(() => <App />, container)` from `lumen/dom` | Render into a DOM node; returns a disposer.          |
| `flushSync()`                                      | Run pending bindings and effects now.                |
| `renderToString(() => <App />)`                    | Server-render to a string (node entry).              |
| `resolve.conditions: ["browser"]`                  | Use the browser entry of `lumen` in component tests. |

## Example

```ts
// vitest.config.ts
import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen()],
  resolve: { conditions: ["browser"] },
  test: { environment: "happy-dom" },
});
```

```tsx check file=Counter.test.tsx
// src/Counter.test.tsx
import { flushSync } from "lumen";
import { mount } from "lumen/dom";
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

- **No `browser` condition.** Components render but never update, because the `node` entry of
  `lumen` has no reactive graph. Add `resolve.conditions: ["browser"]`.
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

See also: [Getting started](../getting-started.md), [reference: `lumen/dom`](../reference/dom.md), [reference: server](../reference/server.md).
