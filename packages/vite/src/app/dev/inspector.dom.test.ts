// @vitest-environment happy-dom
// The in-page inspector of `lumiose dev` (decision-59, TASK-341, ./inspector.ts), mounted over a
// registry built by hand: opening and closing it, its four panels, picking an element and
// Alt+click to the source. The runtime's registry itself is tested in lumiose
// (src/dom/devtools.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComponentRecord,
  IslandRecord,
  ReactiveRecord,
  Registry,
  RunRecord,
} from "lumiose/internal/dom/devtools.ts";
import { mountInspector, type Inspector } from "./inspector.ts";

const KEY = Symbol.for("lumiose.devtools");
const options = { root: "/repo/app", base: "/" };

function reactive(
  fields: Partial<ReactiveRecord> & Pick<ReactiveRecord, "id" | "kind">,
): ReactiveRecord {
  return {
    label: undefined,
    internal: false,
    node: { flags: 0 },
    component: undefined,
    host: undefined,
    seq: 0,
    write: undefined,
    runs: 0,
    run: undefined,
    ...fields,
  };
}

/** A page with an island `App > Counter`: a `count` signal shown by a binding of the button. */
function page(): { registry: Registry; target: HTMLButtonElement } {
  document.body.innerHTML = `<main data-lumiose-source="src/routes/page.stsx:3:5"><button data-lumiose-source="src/Counter.stsx:9:5">2</button><p>static</p></main>`;
  const target = document.querySelector("button")!;
  const app: ComponentRecord = {
    id: 1,
    name: "App",
    source: "src/App.stsx:2:8",
    props: {},
    parent: undefined,
    children: [],
    nodes: [target],
    reactive: [],
    island: undefined,
  };
  const counter: ComponentRecord = {
    id: 2,
    name: "Counter",
    source: "src/Counter.stsx:4:17",
    props: { start: 1 },
    parent: app,
    children: [],
    nodes: [target],
    reactive: [],
    island: undefined,
  };
  app.children.push(counter);
  const island: IslandRecord = {
    id: 0,
    ref: "/src/App.stsx#App",
    strategy: "visible",
    value: "200px",
    state: "hydrated",
    armed: 10,
    loading: 12,
    loaded: 20.5,
    hydrated: 22,
    failed: undefined,
    error: undefined,
    start: undefined,
    end: undefined,
    component: app,
  };
  app.island = island;
  const broken: IslandRecord = {
    ...island,
    id: 1,
    ref: "/src/Chart.stsx#Chart",
    strategy: "load",
    value: undefined,
    state: "failed",
    error: new TypeError("Failed to fetch dynamically imported module"),
    component: undefined,
  };
  const count = reactive({
    id: 3,
    kind: "signal",
    label: "count",
    component: counter,
    write: { seq: 2, time: 90, value: 2, previous: 1, where: undefined },
  });
  const binding = reactive({ id: 4, kind: "binding", component: counter, host: target, runs: 2 });
  const run: RunRecord = {
    record: binding,
    seq: 2,
    time: 95,
    causes: [{ source: count, write: count.write!, via: [] }],
  };
  binding.run = run;
  counter.reactive.push(count, binding);
  const theme = reactive({ id: 5, kind: "signal", label: "theme" });
  const busy = reactive({ id: 6, kind: "computed", label: "isBusy()", internal: true });
  const registry: Registry = {
    version: 1,
    roots: [app],
    islands: [island, broken],
    global: [theme, busy],
    updates: [run],
    changes: 1,
    recordOf: () => undefined,
    bindingsOf: (node) => (node === target ? [binding] : []),
    dependents: (record) => (record === count ? [binding] : []),
    valueOf: (record) => ({ value: record === theme ? "dark" : 2, stale: false }),
    snapshot: (component) =>
      component === counter ? [{ key: "start", kind: "value", value: 1 }] : [],
    prune: () => {},
  };
  (globalThis as Record<symbol, unknown>)[KEY] = registry;
  return { registry, target };
}

let inspector: Inspector | undefined;
let fetched: string[];

beforeEach(() => {
  sessionStorage.clear();
  fetched = [];
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    return Promise.resolve(new Response(""));
  });
});
afterEach(() => {
  inspector?.unmount();
  inspector = undefined;
  delete (globalThis as Record<symbol, unknown>)[KEY];
  document.body.textContent = "";
  vi.unstubAllGlobals();
});

function mount(): ShadowRoot {
  inspector = mountInspector(options);
  return inspector.shadowRoot;
}

const panel = (root: ShadowRoot): HTMLElement => root.querySelector(".panel")!;
const text = (root: ShadowRoot): string => panel(root).textContent ?? "";

function press(init: KeyboardEventInit): void {
  dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

function button(root: ShadowRoot, label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  if (found === undefined) throw new Error(`no button ${label}`);
  return found;
}

describe("the inspector", () => {
  it("mounts a corner button in a closed shadow root, and opens with Alt+Shift+L", () => {
    page();
    const root = mount();
    const host = document.querySelector("lumiose-inspector")!;
    expect(host.shadowRoot).toBeNull();
    expect(panel(root).hidden).toBe(true);
    expect(root.querySelector(".toggle")!.getAttribute("aria-label")).toBe("Lumiose inspector");
    press({ code: "KeyL", key: "Ò", altKey: true, shiftKey: true });
    expect(panel(root).hidden).toBe(false);
    press({ code: "KeyL", key: "Ò", altKey: true, shiftKey: true });
    expect(panel(root).hidden).toBe(true);
  });

  it("opens with the corner button, closes with ×, and remembers it for the session", () => {
    page();
    let root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    expect(panel(root).hidden).toBe(false);
    inspector!.unmount();
    root = mount();
    expect(panel(root).hidden).toBe(false);
    (root.querySelector(".close") as HTMLButtonElement).click();
    expect(panel(root).hidden).toBe(true);
  });

  it("shows the component tree, with props, source and island", () => {
    page();
    const root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    const rows = [...root.querySelectorAll(".row")].map((row) => row.textContent);
    expect(rows).toEqual(["Appisland · visibleApp.stsx:2", "CounterCounter.stsx:4"]);
    button(root, "Counter").click();
    expect(text(root)).toContain("src/Counter.stsx:4:17");
    expect(text(root)).toContain("start1");
    expect(text(root)).toContain("1 signal, 1 binding");
    button(root, "src/Counter.stsx:4:17").click();
    expect(fetched).toEqual([
      `/__open-in-editor?file=${encodeURIComponent("/repo/app/src/Counter.stsx:4:17")}`,
    ]);
  });

  it("lists signals with values, dependents and their last write; Lumiose's own on demand", () => {
    page();
    const root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    button(root, "Counter").click();
    button(root, "Signals").click();
    expect(text(root)).toContain("count signal");
    expect(text(root)).toContain("binding of <button>");
    expect(text(root)).toContain("1 → 2");
    button(root, "Outside components").click();
    expect(text(root)).toContain("theme");
    expect(text(root)).not.toContain("isBusy()");
    button(root, "Show Lumiose's own signals (1)").click();
    expect(text(root)).toContain("isBusy()");
  });

  it("lists islands with strategy, state, timings and failures", () => {
    page();
    const root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    button(root, "Islands").click();
    const rows = [...root.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["App", "visible (200px)", "hydrated", "10 ms", "8.5 ms", "1.5 ms", ""],
      [
        "Chart",
        "load",
        "failed",
        "10 ms",
        "8.5 ms",
        "1.5 ms",
        "TypeError: Failed to fetch dynamically imported module",
      ],
    ]);
  });

  it("explains why the picked element updated", () => {
    const { target } = page();
    const root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    button(root, "Why did this update").click();
    expect(text(root)).toContain("Latest updates");
    expect(text(root)).toContain("binding of <button> in Counter");
    expect(text(root)).toContain("count in Counter: 1 → 2");
    button(root, "Select").click();
    target.click();
    expect(text(root)).toContain("Selected <button> in Counter");
    const cells = [...root.querySelectorAll("table")[0]!.querySelectorAll("tbody td")].map(
      (cell) => cell.textContent,
    );
    expect(cells.slice(0, 3)).toEqual(["binding of <button>", "2", "2"]);
    expect(cells[3]).toContain("count: 1 → 2");
  });

  it("opens an element's source on Alt+click, and leaves other clicks alone", () => {
    const { target } = page();
    mount();
    const plain = document.querySelector("p")!;
    const alt = new MouseEvent("click", { bubbles: true, cancelable: true, altKey: true });
    plain.dispatchEvent(alt);
    expect(alt.defaultPrevented).toBe(true);
    expect(fetched).toEqual([
      `/__open-in-editor?file=${encodeURIComponent("/repo/app/src/routes/page.stsx:3:5")}`,
    ]);
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, altKey: true }));
    expect(fetched[1]).toContain(encodeURIComponent("src/Counter.stsx:9:5"));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    target.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(fetched).toHaveLength(2);
  });

  it("says when the page runs no Lumiose code", () => {
    const root = mount();
    (root.querySelector(".toggle") as HTMLButtonElement).click();
    expect(text(root)).toContain("No Lumiose runtime on this page yet");
  });
});
