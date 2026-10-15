# Testing

> Test components with Vitest and Testing Library (queries and user-event against the real DOM that `render()` builds), server rendering as HTML strings, and whole apps end to end with Playwright.

## Concept

**Three kinds of tests**, with stock tools and no Lumiose adapter package:

| Test             | Tools                                                                      | What it runs                                       |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Component        | Vitest, `happy-dom`, `@testing-library/dom`, `@testing-library/user-event` | `render()` from `lumiose/dom` into `document.body` |
| Server rendering | Vitest (node environment)                                                  | `renderToString(() => <Page />)`                   |
| End to end       | Playwright (`@playwright/test`)                                            | The built app, served by `lumiose preview`         |

Vitest uses your Vite config, so `lumiose()` compiles `.stsx` and `.tsx` test subjects the same way
as the app. Two things matter for component tests:

- **A DOM environment.** Use `happy-dom` (or `jsdom`), per file with
  `// @vitest-environment happy-dom` or for all tests with `test.environment`.
- **The browser build of `lumiose`.** `lumiose` has a browser entry (signals, the DOM renderer) and a
  `node` entry (server rendering, where signals are plain values and effects never run). Vitest
  resolves Node conditions, but `lumiose()` gives tests in a DOM environment the browser entry of
  `lumiose`, so rendered components update. Tests without a DOM environment keep the `node` entry.

**Testing Library.** `render()` builds real DOM nodes, so `@testing-library/dom` works as it is:
query by role, label or text (`screen.getByRole("button", { name: "Add" })`), and drive the page
with `@testing-library/user-event`, which types and clicks like a user. Render into a container
appended to `document.body` (delegated handlers such as `onClick` listen at `document`), and call
the disposer `render()` returns after each test. `await user.click(…)` returns after the handler's
updates are applied: a write inside a delegated handler is flushed when the handler ends. For
matchers such as `toBeDisabled()`, add `@testing-library/jest-dom`.

Updates outside handlers are batched: after a write in the test itself (`count.set(3)`), call
`flush()` before asserting, or use a `findBy…` query, which retries until the element appears.

**Server rendering** is tested with `renderToString(() => <Page />)` under the `node` entry: a test
file without a DOM environment, in the same project.

**End to end.** Playwright drives a browser against the production build: its `webServer` option
runs `lumiose build` and `lumiose preview`, and tests visit pages, click and assert. Islands replay
clicks and input that happen before they hydrate, so tests need no wait for hydration. Keep these
tests to the flows that need a real browser and a server: navigation, forms that post to actions,
and the islands on them.

**Scoped state is fresh in each test.** `lumiose()` adds a Vitest setup file that resets
`defineState` instances before each test, so one test's cart never leaks into the next. In server
tests, a state's accessor called outside a render (to seed or inspect it) uses one instance per
test, which `renderToString` then shares.

## API

| API                                                     | Use                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `render(() => <App />, container)` from `lumiose/dom`   | Render into a DOM node; returns a disposer.                             |
| `screen`, `within(element)` from `@testing-library/dom` | Queries: `getBy…` (now), `findBy…` (waits), `queryBy…` (may be absent). |
| `userEvent.setup()` from `@testing-library/user-event`  | `await user.click(el)`, `user.type(el, text)`, `user.keyboard(…)`.      |
| `flush()`                                               | Run pending bindings and effects now.                                   |
| `renderToString(() => <App />)`                         | Server-render to a string (node entry).                                 |
| `playwright.config.ts`: `webServer`, `use.baseURL`      | Build and serve the app for end-to-end tests.                           |

## Example

```ts
// vitest.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
  test: { environment: "happy-dom", include: ["src/**/*.test.{ts,tsx}"] },
});
```

A form component and its test:

```stsx check file=components/TodoForm.stsx
// src/components/TodoForm.stsx
import { signal } from "lumiose";

export function TodoForm(props: { onAdd?: (title: string) => void }) {
  const title = signal("");
  const todos = signal<string[]>([]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        todos.update((list) => [...list, title()]);
        props.onAdd?.(title());
        title.set("");
      }}
    >
      <label>
        Title <input bind:value={title} />
      </label>
      <button disabled={title() === ""}>Add</button>
      <ul>
        {todos().map((todo) => (
          <li>{todo}</li>
        ))}
      </ul>
    </form>
  );
}
```

```tsx check file=components/TodoForm.test.tsx
// src/components/TodoForm.test.tsx
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { render } from "lumiose/dom";
import { afterEach, expect, it, vi } from "vitest";
import { TodoForm } from "./TodoForm.stsx";

let dispose: (() => void) | undefined;

// Attached to document.body, where delegated handlers listen; disposed after each test.
function mount(ui: () => JSX.Element) {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
}

afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
});

it("adds a todo", async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  mount(() => <TodoForm onAdd={onAdd} />);

  const add = screen.getByRole<HTMLButtonElement>("button", { name: "Add" });
  expect(add.disabled).toBe(true);

  await user.type(screen.getByLabelText("Title"), "Write tests");
  expect(add.disabled).toBe(false);
  await user.click(add);

  expect(within(screen.getByRole("list")).getByText("Write tests")).toBeTruthy();
  expect(onAdd).toHaveBeenCalledWith("Write tests");
  expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("");
});
```

A test that writes a signal itself flushes before asserting:

```tsx check file=Counter.test.tsx
// src/Counter.test.tsx
import { flush } from "lumiose";
import { render } from "lumiose/dom";
import { expect, it } from "vitest";
import { Counter } from "./Counter.stsx";

it("counts clicks", () => {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = render(() => <Counter start={2} />, container);

  const button = container.querySelector("button")!;
  button.click();
  flush();

  expect(button.textContent).toContain("Clicked 3 times");
  dispose();
  container.remove();
});
```

End to end with Playwright (`pnpm add -D @playwright/test`, then `npx playwright install chromium`):

```ts check
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Builds the app and serves the build, as production would.
  webServer: {
    command: "lumiose build && lumiose preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
```

```ts check
// e2e/guestbook.spec.ts
import { expect, test } from "@playwright/test";

test("signs the guestbook", async ({ page }) => {
  await page.goto("/guestbook");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Message").fill("Hello");
  await page.getByRole("button", { name: "Sign" }).click();
  // The form posts to the page's action, which redirects back to the list.
  await expect(page.getByText("Ada: Hello")).toBeVisible();
});
```

Run it with `npx playwright test`. Keep `e2e/` out of Vitest's `include`, as above.

## Common mistakes

- **No DOM environment.** Without `happy-dom` (or `jsdom`) there is no `document`, and `lumiose`
  resolves to its `node` entry, which has no reactive graph: set the environment for component
  tests.
- **Asserting right after a write in the test.** Effects and bindings run in a microtask; call
  `flush()` first, or query with `findBy…`.
- **Rendering into a detached element.** Delegated handlers listen at `document`; append the
  container to `document.body`, or user-event clicks reach no handler.
- **Not disposing.** Call the disposer returned by `render` so effects and listeners from one test
  do not leak into the next, and clear `document.body` so `screen` queries see one test's DOM.
- **Testing server components in a DOM environment.** Async server components that use
  `request()`, `cookies()` or `*.server.ts` modules belong in server-side tests with
  `renderToString`, or in end-to-end tests.
- **Running end-to-end tests against `lumiose dev`.** The dev server compiles on demand and sends
  no CSP; test the build with `lumiose preview`.
- **Waiting for hydration in Playwright.** Islands replay early clicks and input; assert on what
  the page shows instead of waiting for a timeout.

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph (also `renderToString` called with the browser entry).
- [LUM4004](../errors/LUM4004.md): browser API at module scope.

See also: [Getting started](../getting-started.md), [reference: `lumiose/dom`](../reference/dom.md), [reference: server](../reference/server.md).
