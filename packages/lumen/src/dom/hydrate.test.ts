// @vitest-environment happy-dom
// Hydration against real compiler output (TASK-18): each case compiles one source for both
// targets, renders islands with the server runtime, parses the HTML into the document, then
// hydrates it with the island loader and the client runtime. Claimed nodes keep their identity,
// awaits replay from the records, and mismatches fall back to a client render.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumen/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "../core/index.ts";
import { island, renderToStream, renderToString } from "../server/index.ts";
import { loadIslands } from "./islands.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "..");
const IMPORTS = {
  client: { "lumen/dom": "dom/index.ts", lumen: "index.ts" },
  server: { "lumen/server": "server/index.ts", lumen: "index.server.ts" },
} as const;
// Compiled modules go to packages/lumen/test/out (ignored), inside the Vite root.
const out = resolve(src, "../test/out/hydrate");
mkdirSync(out, { recursive: true });
let counter = 0;

type Module = Record<string, any>;

/** Compiles `source` for both targets and imports the two modules. */
async function load(source: string): Promise<{ client: Module; server: Module }> {
  const id = counter++;
  const modules: Record<string, Module> = {};
  for (const target of ["client", "server"] as const) {
    const result = compile(source, `/src/case${id}.tsx`, {
      target,
      styleImport: false,
      sourceMap: false,
    });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    let code = result.code;
    for (const [specifier, file] of Object.entries(IMPORTS[target])) {
      code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
    }
    const path = join(out, `case${id}-${Date.now()}.${target}.js`);
    writeFileSync(path, code);
    modules[target] = (await import(/* @vite-ignore */ path)) as Module;
  }
  return modules as { client: Module; server: Module };
}

interface Api {
  /** Ids requested through `fetch` (server and client). */
  calls: string[];
  member(id: string): Promise<{ name: string }>;
}

/** Data source used by the cases' async components, through `fetch` like `fetchJSON`. */
const api: Api = {
  calls: [],
  member: (id) => fetch(`/api/member/${id}`).then((response) => response.json()),
};
(globalThis as Record<string, unknown>).api = api;
globalThis.fetch = ((url: string) => {
  const id = url.slice(url.lastIndexOf("/") + 1);
  api.calls.push(id);
  return Promise.resolve({ json: () => Promise.resolve({ name: `name-${id}` }) });
}) as unknown as typeof fetch;

/** Server-renders `islands` (export name → props, strategy load) into the document. */
async function serve(
  server: Module,
  islands: [name: string, props: object, slots?: Record<string, () => unknown>][],
): Promise<void> {
  const html = await renderToString(() =>
    islands.map(([name, props, slots]) =>
      island(`/src/case#${name}`, server[name], props, "load", undefined, slots),
    ),
  );
  document.body.innerHTML = html;
  api.calls = [];
}

/** Hydrates the document's islands from `client` and waits until replayed awaits rendered. */
async function hydrateAll(client: Module): Promise<void> {
  const manifest: Record<string, () => Promise<unknown>> = {};
  for (const name of Object.keys(client)) {
    manifest[`/src/case#${name}`] = () => Promise.resolve(client[name]);
  }
  loadIslands(manifest);
  await settle();
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((done) => setTimeout(done, 0));
  }
  flushSync();
}

/** Body HTML without hydration markers and island records, for comparisons. */
function visible(): string {
  return document.body.innerHTML
    .replace(/<script[^>]*>.*?<\/script>/g, "")
    .replace(/<!--.*?-->/g, "");
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  document.body.textContent = "";
});

describe("hydrate", () => {
  it("claims a counter's nodes and makes it interactive", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Counter(props: { start: number }) {
        const count = signal(props.start);
        return <button class={{ hot: count() > 5 }} onClick={() => count.set(count() + 1)}>Clicked {count()} times</button>;
      }`);
    await serve(server, [["Counter", { start: 5 }]]);
    const button = document.querySelector("button")!;
    const text = button.childNodes[2]!;
    expect(text.textContent).toBe("5");
    expect(button.textContent).toBe("Clicked 5 times");
    await hydrateAll(client);
    expect(document.querySelector("button")).toBe(button);
    button.click();
    flushSync();
    expect(button.textContent).toBe("Clicked 6 times");
    expect(button.childNodes[1]).toBe(text);
    expect(button.className).toBe("hot");
    expect(warn).not.toHaveBeenCalled();
  });

  it("adopts every kind of hole: placeholders, static markers, appends, eager values, text", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Card(props: { n: number }) {
        return <i>card {props.n}</i>;
      }
      export function Markers(props: { a: string; b: string; e: string }) {
        const a = signal(props.a);
        const b = signal(props.b);
        const e = signal(props.e);
        (globalThis as any).set = (v: string) => { a.set(v); b.set(v); e.set(v); };
        return (
          <div>
            <p>before {a()} after</p>
            <p>{a()}{b()}</p>
            <p>{a()} trailing</p>
            <p><br />{a()}<br /></p>
            <p>leading {a()}</p>
            <p><Card n={1} />{b()}<Card n={2} /></p>
            <span>{\`\${e()}\`}</span>
            <p>{a()}</p>
          </div>
        );
      }`);
    await serve(server, [["Markers", { a: "A", b: "B", e: "" }]]);
    const html = visible();
    const div = document.querySelector("div")!;
    const cards = [...document.querySelectorAll("i")];
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(visible()).toBe(html);
    expect(document.querySelector("div")).toBe(div);
    expect([...document.querySelectorAll("i")]).toEqual(cards);
    expect(cards[0]).toBe(document.querySelectorAll("i")[0]);
    (globalThis as any).set("z");
    flushSync();
    expect(div.textContent).toBe(
      "before z afterzzz trailingzleading zcard 1zcard 2zz",
    );
    expect(document.querySelectorAll("i")[1]).toBe(cards[1]);
  });

  it("claims keyed list rows in place and reconciles them afterwards", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Rows(props: { items: string[] }) {
        const items = signal(props.items);
        (globalThis as any).setItems = (v: string[]) => items.set(v);
        return <ul>{items().map((item) => <li key={item} onClick={() => items.set(items().filter((i) => i !== item))}>{item}</li>)}</ul>;
      }`);
    await serve(server, [["Rows", { items: ["a", "b", "c"] }]]);
    const rows = [...document.querySelectorAll("li")];
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect([...document.querySelectorAll("li")]).toEqual(rows);
    expect(rows.every((row, i) => row === document.querySelectorAll("li")[i])).toBe(true);
    rows[1]!.click();
    flushSync();
    expect(document.querySelector("ul")!.textContent).toBe("ac");
    (globalThis as any).setItems(["c", "a", "d"]);
    flushSync();
    expect(document.querySelector("ul")!.textContent).toBe("cad");
    expect(document.querySelectorAll("li")[0]).toBe(rows[2]);
  });

  it("adopts branches and flips them afterwards", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Toggle(props: { on: boolean }) {
        const on = signal(props.on);
        (globalThis as any).toggle = () => on.set(!on());
        return <section>{on() ? <b>yes</b> : <i>no</i>}<p>{on() ? "on" : <em>off</em>}</p></section>;
      }`);
    await serve(server, [["Toggle", { on: true }]]);
    const b = document.querySelector("b")!;
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("b")).toBe(b);
    (globalThis as any).toggle();
    flushSync();
    expect(visible()).toBe("<section><i>no</i><p><em>off</em></p></section>");
    (globalThis as any).toggle();
    flushSync();
    expect(document.querySelector("section")!.textContent).toBe("yeson");
  });

  // Server output for value positions written by hand (`branch()`/`list()` in children, as
  // TASK-50 is to emit), against the compiler's client output (`branchValue`/`listValue`).
  it("adopts parentless branches and lists in component children", async () => {
    const { client } = await load(`
      import { signal } from "lumen";
      export function Shelf(props: { on: boolean; items: string[] }) {
        const on = signal(props.on);
        const items = signal(props.items);
        (globalThis as any).flip = () => on.set(!on());
        (globalThis as any).setItems = (v: string[]) => items.set(v);
        return (
          <section>
            <Box>{on() ? <u>inner yes</u> : "inner no"}</Box>
            <Box>{items().map((item) => <s key={item}>{item}</s>)}</Box>
          </section>
        );
      }
      function Box(props: { children?: any }) {
        return <div>{props.children}</div>;
      }`);
    const s = await import("../server/index.ts");
    const Box = (props: { children?: unknown }) => s.ssr(["<div>", "</div>"], s.insert(props.children));
    const Shelf = (props: { on: boolean; items: string[] }) =>
      s.ssr(
        ["<section>", "", "</section>"],
        s.insert(
          s.createComponent(Box, {
            get children() {
              return s.branch(props.on, () => s.ssr(["<u>inner yes</u>"]), () => "inner no");
            },
          }),
        ),
        s.insert(
          s.createComponent(Box, {
            get children() {
              return s.list(props.items, (item: string) => s.ssr(["<s>", "</s>"], s.insert(item)));
            },
          }),
        ),
      );
    await serve({ Shelf }, [["Shelf", { on: true, items: ["a", "b"] }]]);
    const u = document.querySelector("u")!;
    const rows = [...document.querySelectorAll("s")];
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("u")).toBe(u);
    expect(rows.every((row, i) => row === document.querySelectorAll("s")[i])).toBe(true);
    (globalThis as any).flip();
    (globalThis as any).setItems(["b", "c"]);
    flushSync();
    expect(visible()).toBe("<section><div>inner no</div><div><s>b</s><s>c</s></div></section>");
    expect(document.querySelector("s")).toBe(rows[1]);
  });

  it("replays awaits of async components and Suspense content without calling the API", async () => {
    const { client, server } = await load(`
      import { signal, Suspense } from "lumen";
      export async function Member(props: { id: string }) {
        const m = await (globalThis as any).api.member(props.id);
        return <h3 onClick={() => (globalThis as any).clicked = m.name}>{m.name}</h3>;
      }
      export function Team(props: { ids: string[] }) {
        const ids = signal(props.ids);
        (globalThis as any).setIds = (v: string[]) => ids.set(v);
        return (
          <section>
            <Member id="lead" />
            <Suspense fallback={<p>loading</p>}>
              <Member id={ids()[0]!} />
              <Member id={ids()[1]!} />
            </Suspense>
          </section>
        );
      }`);
    await serve(server, [["Team", { ids: ["a", "b"] }]]);
    const heads = [...document.querySelectorAll("h3")];
    expect(heads.map((h) => h.textContent)).toEqual(["name-lead", "name-a", "name-b"]);
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
    expect(document.querySelector("p")).toBe(null);
    expect([...document.querySelectorAll("h3")]).toEqual(heads);
    expect(heads.every((h, i) => h === document.querySelectorAll("h3")[i])).toBe(true);
    heads[2]!.click();
    expect((globalThis as any).clicked).toBe("name-b");
    // Replayed runs still track what their await expressions read, and later runs fetch.
    (globalThis as any).setIds(["a", "c"]);
    flushSync();
    await settle();
    expect(api.calls).toEqual(["a", "c"]);
    expect(document.querySelector("section")!.textContent).toBe("name-leadname-aname-c");
    expect(document.querySelector("p")).toBe(null);
  });

  it("renders a server-rendered ErrorBoundary fallback afresh", async () => {
    const { client, server } = await load(`
      import { ErrorBoundary } from "lumen";
      function Risky() {
        if (typeof window === "undefined" || (globalThis as any).serverSide) throw new Error("server only failure");
        return <b>ok</b>;
      }
      export function Guarded() {
        return <div><ErrorBoundary fallback={<i>failed</i>}><Risky /></ErrorBoundary></div>;
      }`);
    (globalThis as any).serverSide = true;
    await serve(server, [["Guarded", {}]]);
    (globalThis as any).serverSide = false;
    const div = document.querySelector("div")!;
    expect(div.textContent).toBe("failed");
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("div")).toBe(div);
    expect(div.textContent).toBe("ok");
  });

  it("adopts inline slots and inserts template slots when the island renders them", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Panel(props: { title: string; children?: any; extra?: any }) {
        const open = signal(false);
        return (
          <article>
            <h2 onClick={() => open.set(!open())}>{props.title}</h2>
            {props.children}
            {open() ? <aside>{props.extra}</aside> : null}
          </article>
        );
      }`);
    const { ssr } = await import("../server/index.ts");
    await serve(server, [
      [
        "Panel",
        { title: "T" },
        { children: () => ssr(["<p>child <b>slot</b></p>"]), extra: () => ssr(["<em>extra</em>"]) },
      ],
    ]);
    expect(document.querySelector("template[data-l-slot=extra]")).not.toBe(null);
    const p = document.querySelector("p")!;
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("p")).toBe(p);
    expect(document.querySelector("template")).toBe(null);
    document.querySelector("h2")!.click();
    flushSync();
    expect(document.querySelector("aside")!.innerHTML).toBe("<em>extra</em>");
    expect(visible()).toBe(
      "<article><h2>T</h2><p>child <b>slot</b></p><aside><em>extra</em></aside></article>",
    );
  });

  it("falls back to a client render on a mismatch, still replaying awaits (LUM4006)", async () => {
    const { client, server } = await load(`
      export async function Profile(props: { id: string }) {
        const m = await (globalThis as any).api.member(props.id);
        return typeof window === "undefined" || (globalThis as any).serverSide ? <p>{m.name}</p> : <div>{m.name}</div>;
      }
      export function Page() {
        return <main><Profile id="x" /></main>;
      }`);
    (globalThis as any).serverSide = true;
    await serve(server, [["Page", {}]]);
    (globalThis as any).serverSide = false;
    const main = document.querySelector("main")!;
    await hydrateAll(client);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LUM4006: hydration mismatch in island Page"));
    expect(api.calls).toEqual([]);
    expect(document.querySelector("main")).not.toBe(main);
    expect(visible()).toBe("<main><div>name-x</div></main>");
  });

  it("detects a branch that renders the other side than the server", async () => {
    const { client, server } = await load(`
      export function Side() {
        return <div>{(globalThis as any).serverSide ? <b>x</b> : <b>y</b>}</div>;
      }`);
    (globalThis as any).serverSide = true;
    await serve(server, [["Side", {}]]);
    (globalThis as any).serverSide = false;
    await hydrateAll(client);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LUM4006"));
    expect(visible()).toBe("<div><b>y</b></div>");
  });
});

/** Appends a streamed chunk to the body and runs its inline scripts (`$swap`). */
function appendChunk(html: string): void {
  const before = document.body.lastChild;
  document.body.insertAdjacentHTML("beforeend", html);
  for (let node = before?.nextSibling ?? document.body.firstChild; node; node = node.nextSibling) {
    if (node.nodeName === "SCRIPT" && !(node as Element).hasAttribute("type")) {
      // oxlint-disable-next-line no-eval -- the server's own `$swap` scripts, as a browser runs them
      (0, eval)(node.textContent!);
    }
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let settled!: (value: T) => void;
  const promise = new Promise<T>((done) => (settled = done));
  return { promise, resolve: settled };
}

describe("island loader", () => {
  it("waits for streamed Suspense content and its appended await records", async () => {
    const { client, server } = await load(`
      import { Suspense } from "lumen";
      export async function Slow(props: { id: string }) {
        const m = await (globalThis as any).api.slow(props.id);
        return <h3 onClick={() => (globalThis as any).clicked = m.name}>{m.name}</h3>;
      }
      export async function Fast(props: { id: string }) {
        const m = await (globalThis as any).api.member(props.id);
        return <h4>{m.name}</h4>;
      }
      export function Feed() {
        return (
          <section>
            <Fast id="f" />
            <Suspense fallback={<p>loading</p>}><Slow id="s" /></Suspense>
          </section>
        );
      }`);
    const slow = deferred<{ name: string }>();
    (api as unknown as Record<string, unknown>).slow = (id: string) =>
      fetch(`/api/slow/${id}`).then(() => slow.promise);
    const shell = await renderToStream(() => island("/src/case#Feed", server.Feed, {}, "load"));
    document.body.innerHTML = shell.body;
    expect(document.querySelector("p")!.textContent).toBe("loading");
    const scan = loadIslands({ "/src/case#Feed": () => Promise.resolve(client.Feed) });
    await settle();
    // Still the server's fallback: the island waits for its streamed content.
    expect(document.querySelector("p")).not.toBe(null);
    slow.resolve({ name: "slow-s" });
    const reader = shell.stream!.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      appendChunk(chunk.value);
    }
    expect(document.querySelector("p")).toBe(null);
    const h3 = document.querySelector("h3")!;
    api.calls = [];
    scan();
    await settle();
    expect(warn).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
    expect(document.querySelector("h3")).toBe(h3);
    h3.click();
    expect((globalThis as any).clicked).toBe("slow-s");
  });

  it("replays clicks and input made before the island hydrated", async () => {
    const { client, server } = await load(`
      import { signal } from "lumen";
      export function Form() {
        const count = signal(0);
        const name = signal("");
        return (
          <div>
            <button onClick={() => count.set(count() + 1)}>{count()}</button>
            <input value={name()} onInput={(e) => name.set(e.currentTarget.value)} />
            <output>{name()}</output>
          </div>
        );
      }`);
    await serve(server, [["Form", {}]]);
    const module = deferred<unknown>();
    loadIslands({ "/src/case#Form": () => module.promise });
    await settle();
    const button = document.querySelector("button")!;
    const input = document.querySelector("input")!;
    let defaultPrevented = false;
    button.addEventListener("click", (e) => (defaultPrevented = e.defaultPrevented));
    button.click();
    button.click();
    input.value = "typed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(button.textContent).toBe("0");
    module.resolve(client.Form);
    await settle();
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("button")).toBe(button);
    expect(button.textContent).toBe("2");
    expect(input.value).toBe("typed");
    expect(document.querySelector("output")!.textContent).toBe("typed");
    expect(defaultPrevented).toBe(false);
  });
});
