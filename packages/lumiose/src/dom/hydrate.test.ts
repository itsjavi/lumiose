// @vitest-environment happy-dom
// Hydration against real compiler output (TASK-18): each case compiles one source for both
// targets, renders islands with the server runtime, parses the HTML into the document, then
// hydrates it with the island loader and the client runtime. Claimed nodes keep their identity,
// awaits replay from the records, and mismatches fall back to a client render.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumiose/compiler";
import type { Renderable } from "../contract/client.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInRequestScope, type RequestScope } from "../app/server/scope.ts";
import { flush } from "../core/index.ts";
import { resetStates } from "../core/state.ts";
import { createComponent, island, renderToStream, renderToString } from "../server/index.ts";
import { loadIslands } from "./islands.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "..");
const IMPORTS = {
  client: { "lumiose/dom/hot": "dom/hot.ts", "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
// Compiled modules go to packages/lumiose/test/out (ignored), inside the Vite root.
const out = resolve(src, "../test/out/hydrate");
mkdirSync(out, { recursive: true });
let counter = 0;

type Module = Record<string, any>;

/** Compiles `source` for both targets and imports the two modules. */
async function load(
  source: string,
  options: { hot?: boolean; states?: string[] } = {},
): Promise<{ client: Module; server: Module }> {
  const id = counter++;
  const modules: Record<string, Module> = {};
  for (const target of ["client", "server"] as const) {
    const result = compile(source, `/src/case${id}.tsx`, {
      target,
      styleImport: false,
      sourceMap: false,
      ...(options.hot && target === "client" ? { hot: true } : {}),
    });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    let code = result.code;
    for (const [specifier, file] of Object.entries(IMPORTS[target])) {
      code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
    }
    // Hot cases: a stand-in for Vite's `import.meta.hot` (`globalThis.hot`).
    if (options.hot) code = code.replaceAll("import.meta.hot", "globalThis.hot");
    // Scoped state ids, as @lumiose/vite appends them to modules that client code reaches.
    for (const name of options.states ?? []) code += `\n${name}.$$id = "/src/case#${name}";`;
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
  flush();
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
      import { signal } from "lumiose";
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
    flush();
    expect(button.textContent).toBe("Clicked 6 times");
    expect(button.childNodes[1]).toBe(text);
    expect(button.className).toBe("hot");
    expect(warn).not.toHaveBeenCalled();
  });

  it("adopts every kind of hole: placeholders, static markers, appends, eager values, text", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
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
    flush();
    expect(div.textContent).toBe("before z afterzzz trailingzleading zcard 1zcard 2zz");
    expect(document.querySelectorAll("i")[1]).toBe(cards[1]);
  });

  it("claims keyed list rows in place and reconciles them afterwards", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
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
    flush();
    expect(document.querySelector("ul")!.textContent).toBe("ac");
    (globalThis as any).setItems(["c", "a", "d"]);
    flush();
    expect(document.querySelector("ul")!.textContent).toBe("cad");
    expect(document.querySelectorAll("li")[0]).toBe(rows[2]);
  });

  it("adopts branches and flips them afterwards", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
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
    flush();
    expect(visible()).toBe("<section><i>no</i><p><em>off</em></p></section>");
    (globalThis as any).toggle();
    flush();
    expect(document.querySelector("section")!.textContent).toBe("yeson");
  });

  // Server output for value positions written by hand (`branch()`/`list()` in children, as
  // TASK-50 is to emit), against the compiler's client output (`branchValue`/`listValue`).
  it("adopts parentless branches and lists in component children", async () => {
    const { client } = await load(`
      import { signal } from "lumiose";
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
    const Box = (props: { children?: unknown }) =>
      s.ssr(["<div>", "</div>"], s.insertText(props.children));
    const Shelf = (props: { on: boolean; items: string[] }) =>
      s.ssr(
        ["<section>", "", "</section>"],
        s.insert(
          s.createComponent(Box, {
            get children() {
              return s.branch(
                props.on,
                () => s.ssr(["<u>inner yes</u>"]),
                () => "inner no",
              );
            },
          }),
        ),
        s.insert(
          s.createComponent(Box, {
            get children() {
              return s.list(props.items, (item: string) =>
                s.ssr(["<s>", "</s>"], s.insertText(item)),
              );
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
    flush();
    expect(visible()).toBe("<section><div>inner no</div><div><s>b</s><s>c</s></div></section>");
    expect(document.querySelector("s")).toBe(rows[1]);
  });

  it("replays awaits of async components and Suspense content without calling the API", async () => {
    const { client, server } = await load(`
      import { signal, Suspense } from "lumiose";
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
    flush();
    await settle();
    expect(api.calls).toEqual(["a", "c"]);
    expect(document.querySelector("section")!.textContent).toBe("name-leadname-aname-c");
    expect(document.querySelector("p")).toBe(null);
  });

  it("opens an insertText fallback before its value claims, as router outlets do (TASK-144)", async () => {
    // Like lumiose/router: a layout's children getter renders the next level into a range that
    // claims the rest of the enclosing region (mode 3) when it is read.
    const { client, server } = await load(`
      export async function Page(props: { id: string }) {
        const m = await (globalThis as any).api.member(props.id);
        return <article><h1 id="user">{m.name}</h1><button>refresh</button></article>;
      }
      function Inner(props: { children?: any }) {
        return <section><button>users</button><p>param</p>{props.children}</section>;
      }
      function Outer(props: { children?: any }) {
        return <div><nav>nav</nav><p id="url">url</p><main>{props.children}</main></div>;
      }
      const outlet = (render: () => any) => (globalThis as any).outlet(render);
      export function Shell(props: { id: string }) {
        return (
          <Outer>
            {outlet(() => <Inner>{outlet(() => <Page id={props.id} />)}</Inner>)}
          </Outer>
        );
      }`);
    (globalThis as any).outlet = (render: () => unknown) => render();
    await serve(server, [["Shell", { id: "a" }]]);
    const h1 = document.querySelector("h1")!;
    expect(h1.textContent).toBe("name-a");
    const { renderRange } = await import("./insert.ts");
    (globalThis as any).outlet = (render: () => Renderable) => renderRange(render, 3);
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
    expect(document.querySelector("h1")).toBe(h1);
    expect(visible()).toBe(
      '<div><nav>nav</nav><p id="url">url</p><main><section><button>users</button><p>param</p>' +
        '<article><h1 id="user">name-a</h1><button>refresh</button></article></section></main></div>',
    );
  });

  it("renders a server-rendered ErrorBoundary fallback afresh", async () => {
    const { client, server } = await load(`
      import { ErrorBoundary } from "lumiose";
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
      import { signal } from "lumiose";
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
    flush();
    expect(document.querySelector("aside")!.innerHTML).toBe("<em>extra</em>");
    expect(visible()).toBe(
      "<article><h2>T</h2><p>child <b>slot</b></p><aside><em>extra</em></aside></article>",
    );
  });

  it("moves no server node while it adopts slots, blocks and text (TASK-152)", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
      export function Card(props: { n: number }) {
        return <i>card {props.n}</i>;
      }
      export function Page(props: { title: string; children?: any }) {
        const count = signal(0);
        (globalThis as any).bump = () => count.set(count() + 1);
        return (
          <main>
            <h1>{props.title}</h1>
            {props.children}
            <p><Card n={1} />{count()}<Card n={2} /></p>
            <footer>{count()} selected</footer>
          </main>
        );
      }`);
    const { ssr } = await import("../server/index.ts");
    await serve(server, [
      ["Page", { title: "T" }, { children: () => ssr(["<table><tr><td>row</td></tr></table>"]) }],
    ]);
    const table = document.querySelector("table")!;
    const cards = [...document.querySelectorAll("i")];
    const moved: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of [...record.removedNodes, ...record.addedNodes]) {
          // Marker comments go and range markers (empty texts) come; content stays put.
          const marker = node.nodeType === 8 || (node.nodeType === 3 && node.textContent === "");
          if (!marker) moved.push(`${node.nodeName} ${node.textContent}`);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await hydrateAll(client);
    observer.disconnect();
    expect(warn).not.toHaveBeenCalled();
    expect(moved).toEqual([]);
    expect(document.querySelector("table")).toBe(table);
    expect([...document.querySelectorAll("i")]).toEqual(cards);
    (globalThis as any).bump();
    flush();
    expect(visible()).toBe(
      "<main><h1>T</h1><table><tbody><tr><td>row</td></tr></tbody></table><p><i>card 1</i>1<i>card 2</i></p><footer>1 selected</footer></main>",
    );
  });

  it("keeps the focus of an input that sits after a block and inside a slot (TASK-173)", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
      export function Form(props: { children?: any }) {
        const n = signal(1);
        return <form><b>{n()}</b>{props.children}<input id="own" /></form>;
      }`);
    const { ssr } = await import("../server/index.ts");
    await serve(server, [["Form", {}, { children: () => ssr(['<input id="slotted">']) }]]);
    for (const id of ["own", "slotted"]) {
      const input = document.getElementById(id) as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);
    }
    (document.getElementById("own") as HTMLInputElement).focus();
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById("own"));
  });

  it("keeps hot-registered components hydrating in place, then re-renders an edited one (TASK-146)", async () => {
    const hot = { data: {} as Record<string, unknown>, invalidate: vi.fn(), accept: vi.fn() };
    (globalThis as Record<string, unknown>).hot = hot;
    const source = (label: string) => `
      import { signal } from "lumiose";
      async function Member(props: { id: string }) {
        const member = await api.member(props.id);
        return <li>{member.name}</li>;
      }
      export function Badge(props: { n: number }) {
        return <b>${label} {props.n}</b>;
      }
      export function Team(props: { ids: string[] }) {
        const picked = signal(0);
        (globalThis as any).pick = () => picked.set(picked() + 1);
        return (
          <section>
            <Badge n={1} />
            <ul>{props.ids.map((id) => <Member id={id} />)}</ul>
            <p>{picked()}</p>
          </section>
        );
      }`;
    try {
      const { client, server } = await load(source("v1"), { hot: true });
      await serve(server, [["Team", { ids: ["a", "b"] }]]);
      const section = document.querySelector("section")!;
      const items = [...document.querySelectorAll("li")];
      await hydrateAll(client);
      // Claimed in place, with the recorded awaits replayed (no refetch, no LUM4006).
      expect(warn).not.toHaveBeenCalled();
      expect(api.calls).toEqual([]);
      expect(document.querySelector("section")).toBe(section);
      expect([...document.querySelectorAll("li")]).toEqual(items);
      (globalThis as any).pick();
      flush();
      expect(section.querySelector("p")!.textContent).toBe("1");

      // An edit to Badge: only its instance re-renders; Team keeps its DOM and state.
      await load(source("v2"), { hot: true });
      flush();
      expect(hot.invalidate).not.toHaveBeenCalled();
      expect(section.querySelector("b")!.textContent).toBe("v2 1");
      expect(document.querySelector("section")).toBe(section);
      expect([...document.querySelectorAll("li")]).toEqual(items);
      expect(section.querySelector("p")!.textContent).toBe("1");
    } finally {
      delete (globalThis as Record<string, unknown>).hot;
    }
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
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("LUM4006: hydration mismatch in island Page"),
    );
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

  it("gives an island the same context on both sides: not the page's, its own (TASK-194)", async () => {
    const { client, server } = await load(`
      import { createContext, signal, useContext } from "lumiose";
      export const Theme = createContext("default");
      function Label() {
        return <i>{useContext(Theme)}</i>;
      }
      export function Themed() {
        const own = useContext(Theme);
        const count = signal(0);
        return (
          <Theme value="island">
            <button onClick={() => count.set(count() + 1)}>{own} <Label /> {count()}</button>
          </Theme>
        );
      }`);
    document.body.innerHTML = await renderToString(() =>
      createComponent(server.Theme, {
        value: "page",
        get children() {
          return island("/src/case#Themed", server.Themed, {}, "load");
        },
      }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("LUM4010: island Themed"));
    const button = document.querySelector("button")!;
    expect(button.textContent).toBe("default island 0");
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("LUM4006"));
    expect(document.querySelector("button")).toBe(button);
    button.click();
    flush();
    expect(button.textContent).toBe("default island 1");
  });

  it("hydrates <Ctx value> providers: nested, shadowed, around conditional and list content", async () => {
    const { client, server } = await load(`
      import { createContext, signal, useContext } from "lumiose";
      const Theme = createContext("default");
      const Size = createContext(0);
      function Label(props: { n?: number }) {
        return <i>{useContext(Theme)}:{useContext(Size)}{props.n}</i>;
      }
      function Section(props: { children?: unknown }) {
        return <Theme value="inner">{props.children}</Theme>;
      }
      export function App() {
        const open = signal(true);
        const items = signal([1, 2]);
        return (
          <div onClick={() => (open.set(!open()), items.set([...items(), items().length + 1]))}>
            <Theme value="outer">
              <Size value={2}>
                <Label />
                {open() ? <Label /> : <b>closed</b>}
                <Section>
                  <Label />
                  {items().map((n) => <Label n={n} />)}
                </Section>
              </Size>
            </Theme>
            <Label />
          </div>
        );
      }`);
    await serve(server, [["App", {}]]);
    const expected =
      "<div><i>outer:2</i><i>outer:2</i><i>inner:2</i><i>inner:21</i><i>inner:22</i><i>default:0</i></div>";
    expect(visible()).toBe(expected);
    const first = document.querySelector("i")!;
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("LUM4006"));
    expect(visible()).toBe(expected);
    expect(document.querySelector("i")).toBe(first);
    document.querySelector("div")!.click();
    flush();
    expect(visible()).toBe(
      "<div><i>outer:2</i><b>closed</b><i>inner:2</i><i>inner:21</i><i>inner:22</i><i>inner:23</i><i>default:0</i></div>",
    );
  });
});

const request = (user: string) => ({ ctx: { locals: { user } } }) as unknown as RequestScope;

describe("scoped state (TASK-193)", () => {
  // Server-only reads in the factory: the browser gets the server's values from the payload.
  const SESSION = `
    import { computed, defineState, locals, signal, store } from "lumiose";
    export const session = defineState(() => {
      const user = signal((globalThis as any).serverSide ? locals().user : "nobody");
      const cart = store({ items: (globalThis as any).serverSide ? ["book"] : [] as string[] });
      return {
        user,
        cart,
        count: computed(() => cart.items.length),
        add: (item: string) => cart.items.push(item),
      };
    });`;

  afterEach(() => {
    (globalThis as any).serverSide = false;
    resetStates(); // what the Vitest setup of @lumiose/vite does between tests
  });

  it("restores server values before islands hydrate, one instance shared by every island", async () => {
    const { client, server } = await load(
      `${SESSION}
      export function Add() {
        const { add, user } = session();
        return <button onClick={() => add("pen")}>{user()} adds</button>;
      }
      export function Count() {
        const s = session();
        return <p>{s.user()}: {s.count()} ({s.cart.items.join(",")})</p>;
      }`,
      { states: ["session"] },
    );
    (globalThis as any).serverSide = true;
    document.body.innerHTML = await runInRequestScope(request("ada"), () =>
      renderToString(() => [
        island("/src/case#Add", server.Add, {}, "load"),
        island("/src/case#Count", server.Count, {}, "load"),
      ]),
    );
    (globalThis as any).serverSide = false;
    expect(visible()).toBe("<button>ada adds</button><p>ada: 1 (book)</p>");
    const p = document.querySelector("p")!;
    await hydrateAll(client);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("p")).toBe(p);
    expect(client.session().user()).toBe("ada");
    document.querySelector("button")!.click();
    flush();
    expect(visible()).toBe("<button>ada adds</button><p>ada: 2 (book,pen)</p>");
  });

  it("sends a state first used in a streamed boundary with its chunk, before its island hydrates", async () => {
    const { client, server } = await load(
      `${SESSION}
      import { Suspense } from "lumiose";
      export async function Slow() {
        await (globalThis as any).api.slow("x");
        return <h3>{session().user()} has {session().count()}</h3>;
      }
      export function Feed() {
        return <section><Suspense fallback={<p>loading</p>}><Slow /></Suspense></section>;
      }
      export function Clock() {
        return <time>now</time>;
      }`,
      { states: ["session"] },
    );
    const slow = deferred<void>();
    (api as unknown as Record<string, unknown>).slow = () => slow.promise;
    (globalThis as any).serverSide = true;
    const shell = await runInRequestScope(request("bob"), () =>
      renderToStream(() => [
        island("/src/case#Clock", server.Clock, {}, "load"),
        island("/src/case#Feed", server.Feed, {}, "load"),
      ]),
    );
    expect(shell.body).not.toContain("data-l-payload");
    document.body.innerHTML = shell.body;
    const scan = loadIslands({
      "/src/case#Clock": () => Promise.resolve(client.Clock),
      "/src/case#Feed": () => Promise.resolve(client.Feed),
    });
    await settle();
    slow.resolve();
    const reader = shell.stream!.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      expect(chunk.value).toMatch(/data-l-payload>.*data-l-islands>/);
      appendChunk(chunk.value);
    }
    (globalThis as any).serverSide = false;
    const h3 = document.querySelector("h3")!;
    expect(h3.textContent).toBe("bob has 1");
    scan();
    await settle();
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("h3")).toBe(h3);
    expect(client.session().cart.items).toEqual(["book"]);
  });

  it("writes values that arrive after the state was created into it", async () => {
    const { client } = await load(SESSION, { states: ["session"] });
    const instance = client.session();
    expect(instance.user()).toBe("nobody");
    document.body.innerHTML = `<script type="application/json" data-l-payload>${JSON.stringify({
      s: { "/src/case#session": { user: "eve", cart: { items: ["map"] } } },
    })}</script>`;
    loadIslands({});
    expect(client.session()).toBe(instance);
    expect([instance.user(), instance.count()]).toEqual(["eve", 1]);
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
      import { Suspense } from "lumiose";
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

  it("also waits where `<?start>` parses as a processing instruction (native patching)", async () => {
    const { client, server } = await load(`
      import { Suspense } from "lumiose";
      export async function Slow(props: { id: string }) {
        const m = await (globalThis as any).api.slow(props.id);
        return <h3>{m.name}</h3>;
      }
      export function Feed() {
        return <section><Suspense fallback={<p>loading</p>}><Slow id="s" /></Suspense></section>;
      }`);
    const slow = deferred<{ name: string }>();
    (api as unknown as Record<string, unknown>).slow = (id: string) =>
      fetch(`/api/slow/${id}`).then(() => slow.promise);
    const shell = await renderToStream(() => island("/src/case#Feed", server.Feed, {}, "load"));
    document.body.innerHTML = shell.body;
    // As Chromium parses them: `<?start name="lb0">` → instruction `start`, data `name="lb0"`.
    const walker = document.createTreeWalker(document.body, 128);
    const placeholders: Comment[] = [];
    for (let c = walker.nextNode(); c !== null; c = walker.nextNode()) {
      if ((c as Comment).data.startsWith("?")) placeholders.push(c as Comment);
    }
    expect(placeholders.length).toBe(2);
    for (const c of placeholders) {
      const [, target, data] = /^\?(\w+) ?(.*)$/.exec(c.data)!;
      c.replaceWith(document.createProcessingInstruction(target!, data!));
    }
    const scan = loadIslands({ "/src/case#Feed": () => Promise.resolve(client.Feed) });
    api.calls = [];
    await settle();
    expect(warn).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
    expect(document.querySelector("p")!.textContent).toBe("loading");

    // The browser patches `<template for>` itself; `$swap` then finds no template.
    slow.resolve({ name: "slow-s" });
    const reader = shell.stream!.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      document.body.insertAdjacentHTML("beforeend", chunk.value);
      for (const template of document.querySelectorAll<HTMLTemplateElement>("template[for]")) {
        const all = document.createTreeWalker(document.body, 64);
        let start = all.nextNode() as ProcessingInstruction;
        while (start.data !== `name="${template.getAttribute("for")}"`) {
          start = all.nextNode() as ProcessingInstruction;
        }
        while ((start.nextSibling as ProcessingInstruction).target !== "end") {
          start.nextSibling!.remove();
        }
        start.nextSibling!.remove();
        start.replaceWith(template.content);
        template.remove();
      }
    }
    const h3 = document.querySelector("h3")!;
    expect(h3.textContent).toBe("slow-s");
    scan();
    await settle();
    expect(warn).not.toHaveBeenCalled();
    expect(api.calls).toEqual([]);
    expect(document.querySelector("h3")).toBe(h3);
  });

  it("replays clicks and input made before the island hydrated", async () => {
    const { client, server } = await load(`
      import { signal } from "lumiose";
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
