// @vitest-environment happy-dom
// The in-page inspector's registry (decision-59, TASK-341): what the runtime reports behind
// `INSPECTED`. The flag is on for this file, as `lumiose dev` defines it (Vitest reads
// `import.meta.env` from process.env).
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../contract/client.ts";
import { computed, effect, flush, signal, store } from "../core/index.ts";
import { island, renderToString, ssr } from "../server/index.ts";
import { bind, createComponent, insert, render, setAttr, template } from "./index.ts";
import { INSPECTED } from "./dev.ts";
import { REGISTRY_KEY, resetRegistry, type ComponentRecord, type Registry } from "./devtools.ts";
import { $hot, $label } from "./hot.ts";
import { loadIslands } from "./islands.ts";

vi.hoisted(() => {
  process.env.LUMIOSE_INSPECTOR = "true";
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
};

function registry(): Registry {
  return (globalThis as Record<symbol, Registry>)[REGISTRY_KEY]!;
}

function find(records: ComponentRecord[], name: string): ComponentRecord | undefined {
  for (const record of records) {
    if (record.name === name) return record;
    const found = find(record.children, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

const button = template(`<button> `);

/** `<button data-n={doubled()}>{label}: {count}</button>`, as the compiler writes it. */
function Counter(props: { label: string; start: number }): Renderable {
  const count = $label(signal(props.start), "count");
  const doubled = $label(
    computed(() => count() * 2),
    "doubled",
  );
  const el = button() as HTMLButtonElement;
  bind(el, doubled, (target, value) => setAttr(target, "data-n", String(value)));
  insert(el, () => `${props.label}: ${count()}`, el.firstChild);
  el.addEventListener("click", () => count.set(count() + 1));
  return el;
}

function App(): Renderable {
  return createComponent(Counter, {
    get label() {
      return "Clicks";
    },
    start: 1,
  });
}

/** Two versions of a hot-updated component. */
function V1(): Renderable {
  $label(signal(1), "v1");
  return template(`<b>`)();
}
function V2(): Renderable {
  $label(signal(2), "v2");
  return template(`<u>`)();
}

let disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
  document.body.textContent = "";
  resetRegistry();
});

function mount(code: () => Renderable): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  disposers.push(render(code, container));
  return container;
}

describe("the inspector registry", () => {
  it("is on in this file (the dev flag)", () => {
    expect(INSPECTED).toBe(true);
  });

  it("records the component tree with props, labels and the nodes each component rendered", () => {
    const container = mount(() => createComponent(App, {}));
    const { roots } = registry();
    const app = find(roots, "App")!;
    const counter = find(roots, "Counter")!;
    expect(roots).toContain(app);
    expect(counter.parent).toBe(app);
    expect(counter.nodes).toEqual([container.firstChild]);
    expect(counter.reactive.map((r) => `${r.kind}:${r.label ?? "-"}`)).toEqual([
      "signal:count",
      "computed:doubled",
      "binding:-",
      "binding:-",
    ]);
    expect(registry().snapshot(counter)).toEqual([
      { key: "label", kind: "value", value: "Clicks" },
      { key: "start", kind: "value", value: 1 },
    ]);
  });

  it("explains an update: the write, through the computed, that re-ran a binding", () => {
    const container = mount(() => createComponent(Counter, { label: "n", start: 1 }));
    const el = container.firstChild as HTMLButtonElement;
    el.click();
    flush();
    expect(el.getAttribute("data-n")).toBe("4");
    const count = find(registry().roots, "Counter")!.reactive[0]!;
    expect(count.write).toMatchObject({ value: 2, previous: 1 });
    expect(count.write!.where).toBeInstanceOf(Error);
    const updates = registry().updates;
    expect(updates).toHaveLength(2);
    const [attribute, text] = updates;
    expect(attribute!.causes.map((c) => [c.source.label, c.via.map((v) => v.label)])).toEqual([
      ["count", ["doubled"]],
    ]);
    expect(text!.causes.map((c) => [c.source.label, c.via])).toEqual([["count", []]]);
    // The bindings that update the element, and what reads `count` now.
    expect(registry().bindingsOf(el)).toEqual([attribute!.record, text!.record]);
    expect(
      registry()
        .dependents(count)
        .map((r) => r?.label ?? r?.kind),
    ).toEqual(["doubled", "binding"]);
    expect(registry().valueOf(count)).toEqual({ value: 2, stale: false });
  });

  it("logs an effect's re-runs, not its first run", () => {
    const value = signal(0);
    let runs = 0;
    mount(() => {
      effect(() => {
        value();
        runs++;
      });
      return null;
    });
    flush();
    expect(registry().updates).toHaveLength(0);
    value.set(1);
    flush();
    expect(runs).toBe(2);
    expect(registry().updates.map((u) => [u.record.kind, u.causes.length])).toEqual([
      ["effect", 1],
    ]);
  });

  it("keeps signals created outside components, and labels store properties", () => {
    const shared = $label(signal("a"), "shared");
    const todos = store({ done: false });
    let seen: boolean | undefined;
    const container = mount(() =>
      createComponent(() => {
        effect(() => {
          seen = todos.done;
        });
        return template(`<p>`)();
      }, {}),
    );
    flush();
    todos.done = true;
    flush();
    expect(seen).toBe(true);
    expect(registry().global.some((r) => r.label === "shared" && r.node)).toBe(true);
    const run = registry().updates.at(-1)!;
    expect(run.causes.map((c) => [c.source.kind, c.source.label])).toEqual([["store", "done"]]);
    shared.set("b");
    expect(container.textContent).toBe("");
  });

  it("reads getter props under a throwaway owner, and leaves children alone", () => {
    let created = 0;
    const Child = (): Renderable => {
      created++;
      effect(() => {});
      return template(`<i>`)();
    };
    mount(() =>
      createComponent((_props: object) => template(`<p>`)(), {
        get icon() {
          return createComponent(Child, {});
        },
        get children() {
          throw new Error("never read");
        },
      }),
    );
    const record = registry().roots.at(-1)!;
    const before = record.children.length;
    const entries = registry().snapshot(record);
    expect(entries.map((e) => [e.key, e.kind])).toEqual([
      ["icon", "value"],
      ["children", "children"],
    ]);
    expect((entries[0] as { value: unknown }).value).toBeInstanceOf(HTMLElement);
    expect(created).toBe(1);
    expect(record.children).toHaveLength(before);
  });

  it("prunes the components of unmounted roots", () => {
    mount(() => createComponent(App, {}));
    expect(find(registry().roots, "App")).toBeDefined();
    disposers.pop()!();
    document.body.textContent = "";
    registry().prune();
    expect(find(registry().roots, "App")).toBeUndefined();
  });

  it("records a hot-registered component's source and its renders after an update", () => {
    const data: Record<string, unknown> = {};
    const hot = { data, invalidate: () => {} };
    const Wrapped = $hot(hot, "Wrapped", V1, "1", "src/Wrapped.stsx:3:1");
    mount(() => createComponent(Wrapped, {}));
    const record = find(registry().roots, "Wrapped")!;
    expect(record.source).toBe("src/Wrapped.stsx:3:1");
    expect(record.reactive.map((r) => r.label)).toEqual(["v1"]);
    $hot(hot, "Wrapped", V2, "2", "src/Wrapped.stsx:4:1");
    flush();
    expect(find(registry().roots, "Wrapped")).toBe(record);
    expect(record.reactive.map((r) => r.label)).toEqual(["v2"]);
    expect(record.nodes[0]!.nodeName).toBe("U");
  });
});

const Island: Component<{ label: string }> = (props) => {
  const el = template(`<p>`)();
  insert(el, () => props.label);
  return el;
};

describe("the inspector registry for islands", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => consoleError.mockClear());

  it("records each island's strategy, steps and root component", async () => {
    document.body.innerHTML = await renderToString(() =>
      island("/src/Island.stsx#Island", () => ssr(["<p>hi</p>"]), { label: "hi" }, "only"),
    );
    loadIslands({ "/src/Island.stsx#Island": () => Promise.resolve(Island) });
    await settle();
    const [record] = registry().islands;
    expect(record).toMatchObject({
      ref: "/src/Island.stsx#Island",
      strategy: "only",
      state: "hydrated",
    });
    expect(record!.loading).toBeLessThanOrEqual(record!.loaded!);
    expect(record!.loaded).toBeLessThanOrEqual(record!.hydrated!);
    expect(record!.component?.name).toBe("Island");
    expect(record!.component?.island).toBe(record);
  });

  it("records a failed load with its error (the loader's report path)", async () => {
    const chunk = new TypeError("Failed to fetch dynamically imported module");
    document.body.innerHTML = await renderToString(() =>
      island("/src/Broken.stsx#Broken", () => ssr(["<p>x</p>"]), {}, "load"),
    );
    loadIslands({ "/src/Broken.stsx#Broken": () => Promise.reject(chunk) });
    await settle();
    expect(registry().islands.at(-1)).toMatchObject({
      ref: "/src/Broken.stsx#Broken",
      state: "failed",
      error: chunk,
    });
  });
});
