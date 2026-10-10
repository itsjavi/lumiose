// @vitest-environment happy-dom
// `<Ctx value>` providers and `useContext` (TASK-191.1): client rendering, deferred children, and
// the server renderer. Hydration and islands are covered in hydrate.test.ts and island.test.ts.
import { describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import {
  createContext,
  flush,
  onCleanup,
  signal,
  useContext,
  type Context,
  type Signal,
} from "../core/index.ts";
import * as server from "../core/server.ts";
import { createComponent as ssrComponent, renderToString, ssr, text } from "../server/index.ts";
import { createComponent, render } from "./index.ts";

/** `<Ctx value={value}>{children()}</Ctx>`, as the compiler emits it (a lazy `children` getter). */
function provider<T>(Ctx: Context<T>, value: T, children: () => Renderable): Renderable {
  return createComponent(Ctx, {
    value,
    get children() {
      return children();
    },
  });
}

/** A component that renders the value it reads, once, as text. */
function reader<T>(Ctx: Context<T>): Renderable {
  return createComponent(() => String(useContext(Ctx)), {});
}

function renderIn(code: () => Renderable): { el: HTMLElement; dispose: () => void } {
  const el = document.createElement("div");
  return { el, dispose: render(code, el) };
}

describe("<Ctx value> on the client", () => {
  it("provides to its subtree only, with nesting and shadowing", () => {
    const Theme = createContext("default");
    const Size = createContext(0);
    const { el } = renderIn(() => [
      provider(Theme, "outer", () =>
        provider(Size, 2, () => [
          reader(Theme),
          reader(Size),
          provider(Theme, "inner", () => [reader(Theme), reader(Size)]),
          reader(Theme),
        ]),
      ),
      reader(Theme),
      reader(Size),
    ]);
    expect(el.textContent).toBe("outer2inner2outerdefault0");
  });

  it("is a plain component: it returns its children unchanged when they are static", () => {
    const Theme = createContext("default");
    const node = document.createElement("b");
    expect(provider(Theme, "x", () => node)).toBe(node);
  });

  it("provides to children rendered later (function children), and disposes them with the region", () => {
    const Theme = createContext("default");
    const show = signal(true);
    const log: string[] = [];
    const Child = (): Renderable => {
      const theme = useContext(Theme);
      onCleanup(() => log.push(`cleanup ${theme}`));
      return theme;
    };
    // `{show() && <Child />}` compiles to a function child, called by the region that renders the
    // provider's output, under that region's owner.
    const { el, dispose } = renderIn(() =>
      provider(Theme, "dark", () => () => (show() ? createComponent(Child, {}) : "off")),
    );
    expect(el.textContent).toBe("dark");
    show.set(false);
    flush();
    expect(el.textContent).toBe("off");
    expect(log).toEqual(["cleanup dark"]);
    show.set(true);
    flush();
    expect(el.textContent).toBe("dark");
    dispose();
    expect(log).toEqual(["cleanup dark", "cleanup dark"]);
  });

  it("keeps its value away from siblings rendered by the same region", () => {
    const Theme = createContext("default");
    // A parent rendering `[<Theme value="dark">{() => …}</Theme>, () => <Reader />]` resolves both
    // functions in one region evaluation; the sibling must not see the provider's value.
    const { el } = renderIn(() => [
      provider(Theme, "dark", () => () => reader(Theme)),
      () => reader(Theme),
    ]);
    expect(el.textContent).toBe("darkdefault");
  });

  it("reads `value` once; a provided signal shares changing state", () => {
    const Theme = createContext("default");
    const Count = createContext<Signal<number> | undefined>(undefined);
    const theme = signal("light");
    const count = signal(0);
    const { el } = renderIn(() =>
      createComponent(Theme, {
        get value() {
          return theme();
        },
        get children() {
          return provider(Count, count, () => [
            reader(Theme),
            createComponent(() => () => useContext(Count)!(), {}),
          ]);
        },
      }),
    );
    expect(el.textContent).toBe("light0");
    theme.set("dark");
    count.set(1);
    flush();
    expect(el.textContent).toBe("light1");
  });
});

describe("<Ctx value> on the server", () => {
  const Theme = server.createContext("default");
  const Label = () => ssr(["<i>", "</i>"], text(server.useContext(Theme)));

  it("provides to its subtree only, with nesting and shadowing", async () => {
    const html = await renderToString(() => [
      ssrComponent(Theme, {
        value: "outer",
        get children(): any {
          return [
            ssrComponent(Label, {}),
            ssrComponent(Theme, {
              value: "inner",
              get children(): any {
                return ssrComponent(Label, {});
              },
            }),
            ssrComponent(Label, {}),
          ];
        },
      }),
      ssrComponent(Label, {}),
    ]);
    expect(html).toBe("<i>outer</i><i>inner</i><i>outer</i><i>default</i>");
  });

  it("provides to function children", async () => {
    const html = await renderToString(() =>
      ssrComponent(Theme, {
        value: "dark",
        get children(): any {
          return () => ssrComponent(Label, {});
        },
      }),
    );
    expect(html).toBe("<i>dark</i>");
  });
});
