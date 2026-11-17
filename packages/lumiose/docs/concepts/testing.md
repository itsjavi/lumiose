# Testing

> Test components with Vitest and Testing Library (queries and user-event against the real DOM that `render()` builds), server rendering as HTML strings, and whole apps end to end with Playwright.

## Concept

### Component tests

`render()` builds real DOM nodes, so `@testing-library/dom` and `user-event` work as they are.
Render into a container appended to `document.body`, and call the disposer after each test.
`await user.click(…)` returns after the handler's updates are applied.

```stsx check file=components/TodoForm.stsx
import { signal } from "lumiose";

export function TodoForm(props: {
  onAdd?: (title: string) => void;
}) {
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
// @vitest-environment happy-dom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { render } from "lumiose/dom";
import { afterEach, expect, it, vi } from "vitest";
import { TodoForm } from "./TodoForm.stsx";

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.replaceChildren();
});

it("adds a todo", async () => {
  const user = userEvent.setup();
  const onAdd = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => <TodoForm onAdd={onAdd} />, container);

  const add = screen.getByRole<HTMLButtonElement>("button");
  expect(add.disabled).toBe(true);

  const input = screen.getByLabelText("Title");
  await user.type(input, "Write tests");
  await user.click(add);

  const list = within(screen.getByRole("list"));
  expect(list.getByText("Write tests")).toBeTruthy();
  expect(onAdd).toHaveBeenCalledWith("Write tests");
});
```

> **Details:** a write in the test itself (`count.set(3)`) needs `flush()` before asserting, or a
> `findBy…` query. That, the DOM environment, the browser entry of `lumiose` in tests and
> `@testing-library/jest-dom`:
> [Testing with Vitest and Playwright](../reference/vite.md#testing-with-vitest-and-playwright).

### Server rendering

A test file without a DOM environment gets the `node` entry of `lumiose`: `renderToString`
returns the HTML of a component, fully resolved.

```tsx check file=components/TodoForm.ssr.test.tsx
// @vitest-environment node
import { renderToString } from "lumiose";
import { expect, it } from "vitest";
import { TodoForm } from "./TodoForm.stsx";

it("renders the form on the server", async () => {
  const html = await renderToString(() => <TodoForm />);
  expect(html).toContain("Add");
});
```

> **Scoped state:** `lumiose()` resets `defineState` instances before each test
> ([details](../reference/vite.md#testing-with-vitest-and-playwright)).

### End to end

Playwright drives a browser against the production build: `webServer` runs `lumiose build` and
`lumiose preview`. Islands replay clicks and input that happen before they hydrate, so tests need
no wait for hydration. Install with `pnpm add -D @playwright/test` and
`npx playwright install chromium`; run with `npx playwright test`.

```ts check
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const url = "http://localhost:4173";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: url },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Builds the app and serves it, as production would.
  webServer: {
    command: "lumiose build && lumiose preview --port 4173",
    url,
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
  // The form posts to the page's action, which
  // redirects back to the list.
  await expect(page.getByText("Ada: Hello")).toBeVisible();
});
```

> **Scope:** keep these tests to the flows that need a real browser and a server: navigation,
> forms that post to actions, and the islands on them.

## API

| API                                                     | Use                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `render(() => <App />, container)` from `lumiose/dom`   | Render into a DOM node; returns a disposer.                        |
| `screen`, `within(element)` from `@testing-library/dom` | `getBy…` (now), `findBy…` (waits), `queryBy…` (may be absent).     |
| `userEvent.setup()` from `@testing-library/user-event`  | `await user.click(el)`, `user.type(el, text)`, `user.keyboard(…)`. |
| `flush()`                                               | Run pending bindings and effects now.                              |
| `renderToString(() => <App />)`                         | Server-render to a string (node entry).                            |
| `playwright.config.ts`: `webServer`, `use.baseURL`      | Build and serve the app for end-to-end tests.                      |

## Example

Vitest uses your Vite config, so `lumiose()` compiles test subjects the same way as the app. Set
the DOM environment for all tests here, or per file with `// @vitest-environment happy-dom`. Keep
`e2e/` out of `include`.

```ts
// vitest.config.ts
import lumiose from "@lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose()],
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

Stock tools, with no Lumiose adapter package:
[The three kinds of tests](../reference/vite.md#the-three-kinds-of-tests).

## Common mistakes

- **No DOM environment.** There is no `document`, and `lumiose` resolves to its `node` entry.
- **Asserting right after a write in the test.** Call `flush()`, or query with `findBy…`.
- **Rendering into a detached element.** Delegated handlers listen at `document`.
- **Not disposing,** or not clearing `document.body` between tests.
- **Server components in a DOM environment.** Test them with `renderToString`, or end to end.
- **End-to-end tests against `lumiose dev`.** Test the build with `lumiose preview`.
- **Waiting for hydration in Playwright.** Assert on what the page shows.

The long forms: [Common testing mistakes](../reference/vite.md#common-testing-mistakes).

## Related diagnostics

- [LUM4003](../errors/LUM4003.md): server-only module in a client graph (also `renderToString` called with the browser entry).
- [LUM4004](../errors/LUM4004.md): browser API at module scope.

See also: [Getting started](../getting-started.md), [reference: `lumiose/dom`](../reference/dom.md), [reference: server](../reference/server.md).
