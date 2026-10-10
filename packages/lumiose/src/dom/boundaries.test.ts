// @vitest-environment happy-dom
// <Suspense>, <ErrorBoundary> and resource() on the client (decision-13, spec §4.4).
import { afterEach, describe, expect, it } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { isBusy, effect, flush, isPending, resource, signal } from "../core/index.ts";
import {
  $async,
  $await,
  $leave,
  bind,
  branch,
  createComponent,
  insert,
  render as renderRoot,
  setText,
} from "./index.ts";
import { ErrorBoundary, Suspense } from "./boundaries.ts";

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

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function p(text: string): HTMLElement {
  const el = document.createElement("p");
  el.textContent = text;
  return el;
}

const disposers: (() => void)[] = [];

function render(code: () => Renderable): HTMLElement {
  const container = document.createElement("div");
  disposers.push(renderRoot(code, container));
  return container;
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

/** An async component that renders `name` once its gate (looked up per run) resolves. */
function gated(gates: Map<string, Deferred<string>>) {
  return $async(async function Gated(props: { name: string }): Promise<Renderable> {
    try {
      const name = props.name;
      const gate = deferred<string>();
      gates.set(name, gate);
      const value = (await $await(() => gate.promise, 0))();
      const el = p(value);
      insert(el, () => (isPending() ? "…" : ""));
      return el;
    } finally {
      $leave();
    }
  });
}

function fallback(): Renderable {
  return p("loading");
}

describe("Suspense", () => {
  it("shows the fallback until every first run below resolves, including nested ones", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const Parent = $async(async function Parent(): Promise<Renderable> {
      try {
        (await $await(() => gates.get("a")!.promise, 0))();
        return [p("A"), createComponent(Gated, { name: "nested" })];
      } finally {
        $leave();
      }
    });
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          return [
            createComponent(Gated, { name: "a" }),
            createComponent(Parent, {}),
            createComponent(Gated, { name: "b" }),
          ];
        },
      }),
    );
    expect(container.textContent).toBe("loading");
    gates.get("a")!.resolve("a");
    await settled();
    expect(container.textContent).toBe("loading");
    gates.get("b")!.resolve("b");
    await settled();
    // `nested` was created when Parent resolved, before Parent released the boundary.
    expect(container.textContent).toBe("loading");
    gates.get("nested")!.resolve("n");
    await settled();
    expect(container.textContent).toBe("aAnb");
  });

  it("keeps the stale UI on re-runs, and shows the fallback again for newly mounted branches", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const name = signal("a");
    const more = signal(false);
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          const el = document.createElement("div");
          const anchor = document.createTextNode("");
          el.append(anchor);
          insert(
            el,
            createComponent(Gated, {
              get name() {
                return name();
              },
            }),
            anchor,
          );
          branch(el, anchor, more, () => createComponent(Gated, { name: "more" }));
          return el;
        },
      }),
    );
    gates.get("a")!.resolve("a");
    await settled();
    expect(container.textContent).toBe("a");

    name.set("b");
    flush();
    await settled();
    expect(container.textContent).toBe("a…");
    gates.get("b")!.resolve("b");
    await settled();
    expect(container.textContent).toBe("b");
    const shown = container.querySelector("p");

    more.set(true);
    flush();
    await settled();
    expect(container.textContent).toBe("loading");
    gates.get("more")!.resolve("more");
    await settled();
    expect(container.textContent).toBe("bmore");
    // The revealed content was hidden, not re-created.
    expect(container.querySelector("p")).toBe(shown);
  });

  it("nests: an inner boundary keeps its own fallback after the outer one reveals", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return p("outer…");
        },
        get children() {
          return [
            createComponent(Gated, { name: "a" }),
            createComponent(Suspense, {
              get fallback() {
                return p("inner…");
              },
              get children() {
                return createComponent(Gated, { name: "b" });
              },
            }),
          ];
        },
      }),
    );
    expect(container.textContent).toBe("outer…");
    gates.get("a")!.resolve("a");
    await settled();
    expect(container.textContent).toBe("ainner…");
    gates.get("b")!.resolve("b");
    await settled();
    expect(container.textContent).toBe("ab");
  });

  it("renders synchronous children at once, and keeps hidden content alive", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const count = signal(0);
    const more = signal(false);
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          const el = p("");
          const label = document.createTextNode("");
          const anchor = document.createTextNode("");
          el.append(label, anchor);
          bind(label, count, setText);
          branch(el, anchor, more, () => createComponent(Gated, { name: "x" }));
          return el;
        },
      }),
    );
    expect(container.textContent).toBe("0");
    more.set(true);
    flush();
    expect(container.textContent).toBe("loading");
    count.set(5);
    flush();
    gates.get("x")!.resolve("x");
    await settled();
    expect(container.textContent).toBe("5x");
  });
});

const Broken = $async(async function Broken(): Promise<Renderable> {
  try {
    (await $await(() => Promise.reject(new Error("boom")), 0))();
    return p("never");
  } finally {
    $leave();
  }
});
function Watcher(): Renderable {
  effect(() => {
    throw new Error("watch");
  });
  return p("watching");
}
const boundary = (child: () => Renderable): HTMLElement =>
  render(() =>
    createComponent(ErrorBoundary, {
      fallback: (error: unknown) => p(`caught ${(error as Error).message}`),
      get children() {
        return createComponent(Suspense, {
          get fallback() {
            return fallback();
          },
          get children() {
            return child();
          },
        });
      },
    }),
  );

describe("runs as boundaries of the content they create", () => {
  it("hold a re-run's swap until new nested async content settles, without a Suspense fallback", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const id = signal("1");
    const Parent = $async(async function Parent(props: { id: string }): Promise<Renderable> {
      try {
        const n = props.id;
        (await $await(() => Promise.resolve(), 0))();
        return [p(`parent ${n}`), createComponent(Gated, { name: `child ${n}` })];
      } finally {
        $leave();
      }
    });
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          return createComponent(Parent, {
            get id() {
              return id();
            },
          });
        },
      }),
    );
    await settled();
    expect(container.textContent).toBe("loading");
    gates.get("child 1")!.resolve("child 1");
    await settled();
    expect(container.textContent).toBe("parent 1child 1");

    id.set("2");
    flush();
    await settled();
    // The new run resolved, but its child has not: the stale UI stays, with no fallback.
    expect(container.textContent).toBe("parent 1child 1");
    gates.get("child 2")!.resolve("child 2");
    await settled();
    expect(container.textContent).toBe("parent 2child 2");
  });

  it("send new pending content below a shown run to the boundary above, and release it on swap", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const id = signal("1");
    const more = signal(false);
    const Parent = $async(async function Parent(props: { id: string }): Promise<Renderable> {
      try {
        const n = props.id;
        (await $await(() => Promise.resolve(), 0))();
        const el = document.createElement("div");
        const anchor = document.createTextNode("");
        el.append(p(`parent ${n}`), anchor);
        branch(el, anchor, more, () => createComponent(Gated, { name: `more ${n}` }));
        return el;
      } finally {
        $leave();
      }
    });
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          return createComponent(Parent, {
            get id() {
              return id();
            },
          });
        },
      }),
    );
    await settled();
    expect(container.textContent).toBe("parent 1");
    more.set(true);
    flush();
    expect(container.textContent).toBe("loading");
    // The re-run's own `more 2` holds its swap; the swap disposes the pending `more 1`.
    id.set("2");
    flush();
    await settled();
    gates.get("more 2")!.resolve("more 2");
    await settled();
    expect(container.textContent).toBe("parent 2more 2");
    expect(isBusy()).toBe(false);
  });
});

describe("ErrorBoundary", () => {
  it("catches async rejections; retry mounts the children again", async () => {
    const attempts: Deferred<string>[] = [];
    const Flaky = $async(async function Flaky(): Promise<Renderable> {
      try {
        const gate = deferred<string>();
        attempts.push(gate);
        return p((await $await(() => gate.promise, 0))());
      } finally {
        $leave();
      }
    });
    let retry!: () => void;
    const container = render(() =>
      createComponent(ErrorBoundary, {
        fallback: (error: unknown, again: () => void) => {
          retry = again;
          return p(`failed: ${(error as Error).message}`);
        },
        get children() {
          return createComponent(Flaky, {});
        },
      }),
    );
    attempts[0]!.reject(new Error("503"));
    await settled();
    expect(container.textContent).toBe("failed: 503");
    retry();
    flush();
    expect(attempts).toHaveLength(2);
    expect(container.textContent).toBe("");
    attempts[1]!.resolve("ok");
    await settled();
    expect(container.textContent).toBe("ok");
  });

  it("catches synchronous throws while rendering and errors of effects below", async () => {
    let broken = true;
    const value = signal(1);
    function Fragile(): Renderable {
      if (broken) {
        throw new Error("render");
      }
      const el = p("");
      bind(
        el,
        () => {
          if (value() > 1) {
            throw new Error("effect");
          }
          return value();
        },
        (target, v) => (target.textContent = String(v)),
      );
      return el;
    }
    let retry!: () => void;
    const container = render(() =>
      createComponent(ErrorBoundary, {
        fallback: (error: unknown, again: () => void) => {
          retry = again;
          return p((error as Error).message);
        },
        get children() {
          return createComponent(Fragile, {});
        },
      }),
    );
    expect(container.textContent).toBe("render");
    broken = false;
    retry();
    flush();
    expect(container.textContent).toBe("1");
    value.set(2);
    flush();
    expect(container.textContent).toBe("effect");
  });

  it("catches rejections inside Suspense and errors of user effects below", async () => {
    const rejected = boundary(() => createComponent(Broken, {}));
    const effectful = boundary(() => createComponent(Watcher, {}));
    expect(rejected.textContent).toBe("loading");
    await settled();
    expect(rejected.textContent).toBe("caught boom");
    expect(effectful.textContent).toBe("caught watch");
  });
});

describe("resource", () => {
  it("loads, reloads when what the fetcher read changes (aborting the old load), and reports errors", async () => {
    const id = signal(1);
    const loads: (Deferred<string> & { signal: AbortSignal })[] = [];
    let r!: ReturnType<typeof resource<string>>;
    const container = render(() => {
      r = resource((abort) => {
        const d = Object.assign(deferred<string>(), { signal: abort, id: id() });
        loads.push(d);
        return d.promise;
      });
      const el = p("");
      bind(
        el,
        () => `${r() ?? "-"}${r.loading() ? " loading" : ""}`,
        (t, v) => (t.textContent = v),
      );
      return el;
    });
    expect(container.textContent).toBe("- loading");
    loads[0]!.resolve("one");
    await settled();
    expect(container.textContent).toBe("one");
    id.set(2);
    flush();
    expect(loads).toHaveLength(2);
    expect(container.textContent).toBe("one loading");
    id.set(3);
    flush();
    expect(loads[1]!.signal.aborted).toBe(true);
    loads[1]!.resolve("two");
    loads[2]!.reject(new Error("gone"));
    await settled();
    expect(container.textContent).toBe("one");
    expect((r.error() as Error).message).toBe("gone");
    r.refetch();
    loads[3]!.resolve("three");
    await settled();
    expect(container.textContent).toBe("three");
    expect(r.error()).toBeUndefined();
  });

  it("counts its first load as pending content for Suspense", async () => {
    const gate = deferred<string>();
    function Data(): Renderable {
      const r = resource(() => gate.promise);
      return () => r();
    }
    const container = render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          return createComponent(Data, {});
        },
      }),
    );
    expect(container.textContent).toBe("loading");
    gate.resolve("data");
    await settled();
    expect(container.textContent).toBe("data");
  });
});

describe("busy", () => {
  it("is true while a run is in flight or a fallback shows, and never re-runs a body that reads it", async () => {
    const gates = new Map<string, Deferred<string>>();
    const Gated = gated(gates);
    const name = signal("a");
    let runs = 0;
    const Reader = $async(async function Reader(): Promise<Renderable> {
      try {
        runs++;
        isBusy();
        (await $await(() => Promise.resolve(), 0))();
        isBusy();
        return null;
      } finally {
        $leave();
      }
    });
    const seen: boolean[] = [];
    const stop = effect(() => {
      seen.push(isBusy());
    });
    render(() =>
      createComponent(Suspense, {
        get fallback() {
          return fallback();
        },
        get children() {
          return [
            createComponent(Reader, {}),
            createComponent(Gated, {
              get name() {
                return name();
              },
            }),
          ];
        },
      }),
    );
    flush();
    expect(isBusy()).toBe(true);
    gates.get("a")!.resolve("a");
    await settled();
    expect(isBusy()).toBe(false);
    name.set("b");
    flush();
    expect(isBusy()).toBe(true);
    gates.get("b")!.resolve("b");
    await settled();
    expect(isBusy()).toBe(false);
    expect(runs).toBe(1);
    expect(seen).toEqual([true, false, true, false]);
    stop();
  });
});
