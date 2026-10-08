// @vitest-environment happy-dom
// Async components on the client (spec §4.4, contract doc-2 §4). Components are written in their
// compiled shape: `(await $await(() => e, site))()` inside `try { … } finally { $leave() }`.
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import {
  createContext,
  flushSync,
  inject,
  lifetime,
  onCleanup,
  pending,
  provide,
  signal,
} from "../core/index.ts";
import { getOwner, type Owner } from "../core/internal.ts";
import { $await, $leave, branch, createComponent, insert, list, mount } from "./index.ts";
import { withIsland } from "./frame.ts";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every pending continuation, swap and flush run. */
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function p(text: string): HTMLElement {
  const el = document.createElement("p");
  el.textContent = text;
  return el;
}

const containers: (() => void)[] = [];

function render(code: () => Renderable): HTMLElement {
  const container = document.createElement("div");
  containers.push(mount(code, container));
  return container;
}

afterEach(() => {
  for (const dispose of containers.splice(0)) {
    dispose();
  }
});

/** A loader whose calls stay pending until the test settles them by argument. */
function loader<T>() {
  const calls = new Map<unknown, Deferred<T> & { signal: AbortSignal | undefined }>();
  return {
    calls,
    load(key: unknown, abort?: AbortSignal): Promise<T> {
      const d = Object.assign(deferred<T>(), { signal: abort });
      calls.set(key, d);
      abort?.addEventListener("abort", () => d.reject(abort.reason));
      return d.promise;
    },
  };
}

async function Row(props: { name: string }): Promise<Renderable> {
  try {
    const name = props.name;
    (await $await(() => Promise.resolve(), 0))();
    return [p(name), p(name.toUpperCase())];
  } finally {
    $leave();
  }
}

async function Member(props: { name: string }): Promise<Renderable> {
  try {
    const name = (await $await(() => `fetched ${props.name}`, 0))();
    let out = "";
    for (const id of [1, 2]) {
      out += (await $await(() => `#${id}`, 1))();
    }
    return p(`${name}${out}`);
  } finally {
    $leave();
  }
}

function Team(): Renderable {
  return [createComponent(Member, { name: "ada" }), createComponent(Member, { name: "bob" })];
}

async function ReplayLeaf(): Promise<Renderable> {
  try {
    return p((await $await(() => "leaf", 0))());
  } finally {
    $leave();
  }
}
function Middle(): Renderable {
  return createComponent(ReplayLeaf, {});
}

async function ReplayOuter(props: { id: number }): Promise<Renderable> {
  try {
    const n = (await $await(() => props.id, 0))();
    return [p(String(n)), createComponent(Middle, {})];
  } finally {
    $leave();
  }
}

describe("async components", () => {
  it("render nothing until the first run resolves, then fill their range in place", async () => {
    const api = loader<string>();
    async function Name(): Promise<Renderable> {
      try {
        const name = (await $await(() => api.load("ada"), 0))();
        return p(name);
      } finally {
        $leave();
      }
    }
    const container = render(() => [p("before"), createComponent(Name, {}), p("after")]);
    expect(container.textContent).toBe("beforeafter");
    api.calls.get("ada")!.resolve("ada");
    await settled();
    expect(container.innerHTML).toBe("<p>before</p><p>ada</p><p>after</p>");
  });

  it("track reads before and after awaits; a re-run keeps the stale UI until it resolves, then swaps atomically", async () => {
    const id = signal(1);
    const suffix = signal("!");
    const api = loader<string>();
    const log: string[] = [];
    let runs = 0;
    async function User(props: { id: number }): Promise<Renderable> {
      try {
        runs++;
        const n = props.id;
        onCleanup(() => log.push(`cleanup ${n}`));
        const name = (await $await(() => api.load(n), 0))();
        const el = p(name + suffix());
        insert(el, () => (pending() ? " (refreshing)" : ""));
        return el;
      } finally {
        $leave();
      }
    }
    const container = render(() =>
      createComponent(User, {
        get id() {
          return id();
        },
      }),
    );
    api.calls.get(1)!.resolve("ada");
    await settled();
    expect(container.textContent).toBe("ada!");

    id.set(2);
    flushSync();
    expect(runs).toBe(2);
    await settled();
    // The old UI stays live (its bindings still update) and pending() is true.
    expect(container.textContent).toBe("ada! (refreshing)");
    expect(log).toEqual([]);

    api.calls.get(2)!.resolve("bob");
    await settled();
    expect(container.textContent).toBe("bob!");
    expect(log).toEqual(["cleanup 1"]);

    // A read after the await is tracked too.
    suffix.set("?");
    flushSync();
    expect(runs).toBe(3);
    await settled();
    expect(container.textContent).toBe("bob! (refreshing)");
    api.calls.get(2)!.resolve("bob");
    await settled();
    expect(container.textContent).toBe("bob?");
    expect(log).toEqual(["cleanup 1", "cleanup 2"]);
  });

  it("let only the latest run win when runs resolve out of order", async () => {
    const id = signal(1);
    const api = loader<string>();
    const lifetimes: AbortSignal[] = [];
    async function User(props: { id: number }): Promise<Renderable> {
      try {
        lifetimes.push(lifetime());
        const n = props.id;
        const name = (await $await(() => api.load(n), 0))();
        return p(name);
      } finally {
        $leave();
      }
    }
    const container = render(() =>
      createComponent(User, {
        get id() {
          return id();
        },
      }),
    );
    api.calls.get(1)!.resolve("one");
    await settled();
    id.set(2);
    flushSync();
    id.set(3);
    flushSync();
    // Run 2 was superseded before it resolved: its lifetime is aborted.
    expect(lifetimes.map((s) => s.aborted)).toEqual([true, true, false]);
    api.calls.get(3)!.resolve("three");
    await settled();
    expect(container.textContent).toBe("three");
    api.calls.get(2)!.resolve("two");
    await settled();
    expect(container.textContent).toBe("three");
  });

  it("cancel superseded and unmounted runs through lifetime(), without reporting their errors", async () => {
    const id = signal(1);
    const api = loader<string>();
    const after: string[] = [];
    async function User(props: { id: number }): Promise<Renderable> {
      try {
        const n = props.id;
        const name = (await $await(() => api.load(n, lifetime()), 0))();
        after.push(name);
        return p(name);
      } finally {
        $leave();
      }
    }
    const show = signal(true);
    const container = render(() => {
      const anchor = document.createTextNode("");
      const frag = document.createDocumentFragment();
      frag.append(anchor);
      branch(frag, anchor, show, () =>
        createComponent(User, {
          get id() {
            return id();
          },
        }),
      );
      return [...frag.childNodes];
    });
    id.set(2);
    flushSync();
    expect(api.calls.get(1)!.signal!.aborted).toBe(true);
    show.set(false);
    flushSync();
    expect(api.calls.get(2)!.signal!.aborted).toBe(true);
    await settled();
    expect(after).toEqual([]);
    expect(container.textContent).toBe("");
  });

  it("restore the owner and context after awaits, also when instances interleave", async () => {
    const Theme = createContext("none");
    const gates = [deferred<void>(), deferred<void>()];
    const owners: (Owner | undefined)[] = [];
    async function Child(props: { gate: number }): Promise<Renderable> {
      try {
        const own = getOwner();
        (await $await(() => gates[props.gate]!.promise, 0))();
        owners.push(getOwner() === own ? own : undefined);
        return p(inject(Theme));
      } finally {
        $leave();
      }
    }
    function Themed(props: { theme: string; gate: number }): Renderable {
      provide(Theme, props.theme);
      return createComponent(Child, { gate: props.gate });
    }
    const container = render(() => [
      createComponent(Themed, { theme: "dark", gate: 0 }),
      createComponent(Themed, { theme: "light", gate: 1 }),
    ]);
    gates[1]!.resolve();
    await settled();
    gates[0]!.resolve();
    await settled();
    expect(container.textContent).toBe("darklight");
    expect(owners.every((owner) => owner !== undefined)).toBe(true);
    expect(getOwner()).toBeUndefined();
  });

  it("run catch blocks with the run restored: $await never rejects", async () => {
    const Ctx = createContext("none");
    async function Safe(): Promise<Renderable> {
      try {
        try {
          (await $await(() => Promise.reject(new Error("offline")), 0))();
          return p("unreachable");
        } catch (error) {
          return p(`${(error as Error).message} in ${inject(Ctx)}`);
        }
      } finally {
        $leave();
      }
    }
    const container = render(() => {
      provide(Ctx, "app");
      return createComponent(Safe, {});
    });
    await settled();
    expect(container.textContent).toBe("offline in app");
  });

  it("render several concurrent instances, each into its own range", async () => {
    const api = loader<string>();
    async function Item(props: { name: string }): Promise<Renderable> {
      try {
        const name = props.name;
        return p((await $await(() => api.load(name), 0))());
      } finally {
        $leave();
      }
    }
    const container = render(() => ["a", "b", "c"].map((name) => createComponent(Item, { name })));
    api.calls.get("c")!.resolve("C");
    await settled();
    api.calls.get("a")!.resolve("A");
    await settled();
    expect(container.textContent).toBe("AC");
    api.calls.get("b")!.resolve("B");
    await settled();
    expect(container.innerHTML).toBe("<p>A</p><p>B</p><p>C</p>");
  });

  it("dispose nested instances created after an await with their run", async () => {
    const id = signal(1);
    const log: string[] = [];
    async function Leaf(props: { n: number }): Promise<Renderable> {
      try {
        const n = props.n;
        onCleanup(() => log.push(`leaf ${n}`));
        (await $await(() => Promise.resolve(), 0))();
        return p(`leaf ${n}`);
      } finally {
        $leave();
      }
    }
    async function Outer(props: { id: number }): Promise<Renderable> {
      try {
        const n = props.id;
        (await $await(() => Promise.resolve(), 0))();
        return createComponent(Leaf, { n });
      } finally {
        $leave();
      }
    }
    const container = render(() =>
      createComponent(Outer, {
        get id() {
          return id();
        },
      }),
    );
    await settled();
    expect(container.textContent).toBe("leaf 1");
    id.set(2);
    flushSync();
    await settled();
    expect(container.textContent).toBe("leaf 2");
    expect(log).toEqual(["leaf 1"]);
  });

  it("do not track pending() in the body, so reading it never re-runs the component", async () => {
    const id = signal(1);
    const seen: boolean[] = [];
    async function Reader(props: { id: number }): Promise<Renderable> {
      try {
        const n = props.id;
        seen.push(pending());
        (await $await(() => Promise.resolve(), 0))();
        seen.push(pending());
        return p(String(n));
      } finally {
        $leave();
      }
    }
    const container = render(() =>
      createComponent(Reader, {
        get id() {
          return id();
        },
      }),
    );
    await settled();
    id.set(2);
    flushSync();
    await settled();
    expect(container.textContent).toBe("2");
    expect(seen).toEqual([false, false, true, true]);
    expect(pending()).toBe(false);
  });

  it("move and remove their whole range with the region or list row they sit in", async () => {
    const rows = signal(["a", "b", "c"]);
    const container = render(() => {
      const parent = document.createElement("section");
      list(parent, null, rows, (name: string) => createComponent(Row, { name }));
      return parent;
    });
    await settled();
    expect(container.textContent).toBe("aAbBcC");
    rows.set(["c", "a"]);
    flushSync();
    expect(container.textContent).toBe("cCaA");
    rows.set([]);
    flushSync();
    expect(container.textContent).toBe("");
  });
});

describe("await replay keys", () => {
  it("look up instancePath:site:occurrence like the server records them", async () => {
    const keys: string[] = [];
    const recorded: Record<string, unknown> = { "0.1:0:0": "replayed bob" };
    const container = withIsland(
      (key) => {
        keys.push(key);
        return key in recorded ? { value: recorded[key] } : undefined;
      },
      () => render(() => createComponent(Team, {})),
    );
    await settled();
    expect(keys.toSorted()).toEqual([
      "0.0:0:0",
      "0.0:1:0",
      "0.0:1:1",
      "0.1:0:0",
      "0.1:1:0",
      "0.1:1:1",
    ]);
    expect(container.textContent).toBe("fetched ada#1#2replayed bob#1#2");
  });

  it("number instances created after an await under the async instance, and never replay re-runs", async () => {
    const keys: string[] = [];
    const id = signal(1);
    const container = withIsland(
      (key) => {
        keys.push(key);
        return undefined;
      },
      () =>
        render(() =>
          createComponent(ReplayOuter, {
            get id() {
              return id();
            },
          }),
        ),
    );
    await settled();
    expect(keys).toEqual(["0:0:0", "0.0.0:0:0"]);
    id.set(2);
    flushSync();
    await settled();
    expect(keys).toHaveLength(2);
    expect(container.textContent).toBe("2leaf");
  });
});
