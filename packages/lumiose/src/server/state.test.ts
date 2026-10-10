// Scoped state on the server (TASK-193, decision-33): one instance per request, seeded by its
// factory from request APIs, and the page payload of the states client code can reach.
import { describe, expect, it, vi } from "vitest";
import { locals, runInRequestScope, type RequestScope } from "../app/server/scope.ts";
import { computed, defineState, signal, store } from "../core/server.ts";
import { resetStates } from "../core/state.ts";
import { Suspense } from "./components.ts";
import { $await, $leave, createComponent, island, renderToStream, ssr, text } from "./index.ts";
import { renderShell } from "./render.ts";
import { decodeData } from "./serialize.ts";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const request = (user: string) => ({ ctx: { locals: { user } } }) as unknown as RequestScope;

/** A state as the Vite plugin leaves it when client code reaches it. */
function sent<T>(ref: string, factory: () => T): () => T {
  return Object.assign(defineState(factory), { $$id: ref });
}

const cart = sent("/src/lib/cart.ts#cart", () => {
  const items = signal<string[]>([(locals() as { user: string }).user]);
  const panel = store({ open: false, tags: new Set(["a"]) });
  return {
    items,
    panel,
    count: computed(() => items().length),
    add: (item: string) => items.update((list) => [...list, item]),
    label: "cart",
  };
});

function Badge() {
  return ssr(["<b>", "</b>"], text(String(cart().count())));
}

/** The decoded `data-l-payload` scripts of some HTML. */
function payloads(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/json" data-l-payload>(.*?)<\/script>/g)].map(
    (match) => {
      const { s } = JSON.parse(match[1]!) as { s: Record<string, unknown> };
      return Object.fromEntries(Object.entries(s).map(([id, data]) => [id, decodeData(data)]));
    },
  );
}

async function streamed(shell: { stream: ReadableStream<string> | null }): Promise<string> {
  let out = "";
  for await (const chunk of shell.stream!) out += chunk;
  return out;
}

/** A request that uses the cart across awaits. */
const serve = (user: string) =>
  runInRequestScope(request(user), async () => {
    const first = cart();
    await sleep(1);
    first.add("pen");
    await sleep(1);
    return { same: cart() === first, items: cart().items() };
  });

/** An async component that first uses the cart after an await, with an island next to it. */
async function LateCart() {
  try {
    (await $await(() => sleep(1), 0))();
    return [
      ssr(["<p>", "</p>"], text(cart().items().join(","))),
      island("/src/Badge.stsx#Badge", Badge, {}, "load"),
    ];
  } finally {
    $leave();
  }
}

/** A Suspense boundary around `LateCart`. */
const Feed = () =>
  createComponent(Suspense, {
    get fallback() {
      return ssr(["…"]);
    },
    get children() {
      return createComponent(LateCart, {});
    },
  });

class Session {
  readonly id = 1;
}

describe("defineState (server)", () => {
  it("keeps one instance per request, never shared across requests", async () => {
    expect(await Promise.all([serve("ada"), serve("bob")])).toEqual([
      { same: true, items: ["ada", "pen"] },
      { same: true, items: ["bob", "pen"] },
    ]);
  });

  it("throws outside a request; a render outside a request gets a scope of its own", async () => {
    expect(() => cart()).toThrow(/defineState\(\) accessor was called outside a request/);
    const counter = defineState(() => signal(0));
    const Count = () => {
      counter().update((n) => n + 1);
      return ssr(["<i>", "</i>"], text(String(counter()())));
    };
    const page = () => [createComponent(Count, {}), createComponent(Count, {})];
    expect((await renderToStream(page)).body).toBe("<i>1</i><i>2</i>");
    expect((await renderToStream(page)).body).toBe("<i>1</i><i>2</i>");
  });

  it("sends the signals and stores of states created during the request, before the records", async () => {
    const shell = await runInRequestScope(request("ada"), () => {
      cart().add("pen"); // before the render, as an action would
      return renderToStream(() => island("/src/Badge.stsx#Badge", Badge, {}, "load"));
    });
    expect(shell.body).toMatch(
      /^<!--l:0--><b>2<\/b><!--\/l:0--><script [^>]*data-l-payload>.*<\/script><script [^>]*data-l-islands>/,
    );
    expect(payloads(shell.body)).toEqual([
      {
        "/src/lib/cart.ts#cart": {
          items: ["ada", "pen"],
          panel: { open: false, tags: new Set(["a"]) },
        },
      },
    ]);
  });

  it("sends a returned signal or store itself", async () => {
    const theme = sent("/src/theme.ts#theme", () => signal("dark"));
    const prefs = sent("/src/prefs.ts#prefs", () => store({ size: 2 }));
    const Read = () => ssr(["<i>", "", "</i>"], text(theme()()), text(String(prefs().size)));
    const shell = await renderToStream(() => island("/src/Read.stsx#Read", Read, {}, "load"));
    expect(payloads(shell.body)).toEqual([
      { "/src/theme.ts#theme": { "": "dark" }, "/src/prefs.ts#prefs": { "": { size: 2 } } },
    ]);
  });

  it("sends nothing for states without an id, rejected states, or a page without islands", async () => {
    const local = defineState(() => signal(1));
    const hidden = sent("/src/hidden.ts#hidden", () => signal(2));
    const Read = () =>
      ssr(
        ["<i>", "", "", "</i>"],
        text(String(local()())),
        text(String(hidden()())),
        text(String(cart().count())),
      );
    const isClientState = vi.fn((ref: string) => ref !== "/src/hidden.ts#hidden");
    const parts = await runInRequestScope(request("ada"), () =>
      renderShell(() => island("/src/Read.stsx#Read", Read, {}, "load"), { isClientState }),
    );
    expect(Object.keys(payloads(parts.records)[0]!)).toEqual(["/src/lib/cart.ts#cart"]);
    expect(isClientState.mock.calls.map(([ref]) => ref).toSorted()).toEqual([
      "/src/hidden.ts#hidden",
      "/src/lib/cart.ts#cart",
    ]);
    const noIslands = await runInRequestScope(request("ada"), () => renderToStream(Read));
    expect(noIslands.body).toBe("<i>121</i>");
  });

  it("streams a state first created in a boundary with that boundary's chunk", async () => {
    const shell = await runInRequestScope(request("ada"), () =>
      renderToStream(() => [
        island("/src/Clock.stsx#Clock", () => ssr(["<time></time>"]), {}, "load"),
        createComponent(Feed, {}),
      ]),
    );
    expect(payloads(shell.body)).toEqual([]);
    const chunk = await streamed(shell);
    expect(chunk).toMatch(
      /<\/template><script>\$swap\("lb0"\)<\/script><script [^>]*data-l-payload>.*<\/script><script [^>]*data-l-islands>/,
    );
    expect(payloads(chunk)).toEqual([
      { "/src/lib/cart.ts#cart": { items: ["ada"], panel: { open: false, tags: new Set(["a"]) } } },
    ]);
  });

  it("rejects values that are not plain data with LUM4011", async () => {
    const session = sent("/src/session.ts#session", () => ({ current: signal(new Session()) }));
    const Read = () => ssr(["<i>", "</i>"], text(String(session().current() !== undefined)));
    const failing = renderToStream(() => island("/src/Read.stsx#Read", Read, {}, "load"));
    await expect(failing).rejects.toMatchObject({ code: "LUM4011" });
    await expect(failing).rejects.toThrow(
      /Value "current" of the scoped state session \(\/src\/session.ts#session\) is an instance of Session/,
    );

    // In a streamed boundary, the boundary keeps its fallback and the error is reported.
    async function Late() {
      try {
        (await $await(() => sleep(1), 0))();
        return createComponent(Read, {});
      } finally {
        $leave();
      }
    }
    const onError = vi.fn();
    const shell = await renderToStream(
      () => [
        island("/src/Clock.stsx#Clock", () => ssr(["<time></time>"]), {}, "load"),
        createComponent(Suspense, {
          get fallback() {
            return ssr(["…"]);
          },
          get children() {
            return createComponent(Late, {});
          },
        }),
      ],
      { onError },
    );
    expect(await streamed(shell)).toBe("");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "LUM4011" }));
  });

  it("shares one scope per test outside requests once resetStates() ran (the Vitest setup)", () => {
    const counter = defineState(() => signal(0));
    resetStates();
    counter().set(3);
    expect(counter()()).toBe(3);
    resetStates();
    expect(counter()()).toBe(0);
  });
});
