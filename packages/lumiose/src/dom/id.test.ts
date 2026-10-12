// @vitest-environment happy-dom
// useId() (TASK-247, decision-43): server ids, hydration parity inside islands, client-only
// counters and the idPrefix option. Cases compile one source for both targets (as in
// ./hydrate.test.ts), render it with the server runtime and hydrate it with the island loader.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumiose/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush } from "../core/index.ts";
import { island, renderToStream, renderToString } from "../server/index.ts";
import { useId as serverUseId } from "../server/id.ts";
import { loadIslands } from "./islands.ts";
import { render } from "./render.ts";

const src = resolve(import.meta.dirname, "..");
const IMPORTS = {
  client: { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
const out = resolve(src, "../test/out/id");
mkdirSync(out, { recursive: true });
let counter = 0;

type Module = Record<string, any>;

/** Ids each case's components report (`globalThis.ids`), in creation order. */
declare global {
  var ids: string[];
}

async function load(source: string): Promise<{ client: Module; server: Module }> {
  const id = counter++;
  const modules: Record<string, Module> = {};
  for (const target of ["client", "server"] as const) {
    const result = compile(source, `/src/id${id}.tsx`, {
      target,
      styleImport: false,
      sourceMap: false,
    });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    let code = result.code;
    for (const [specifier, file] of Object.entries(IMPORTS[target])) {
      code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
    }
    const path = join(out, `id${id}-${Date.now()}.${target}.js`);
    writeFileSync(path, code);
    modules[target] = (await import(/* @vite-ignore */ path)) as Module;
  }
  return modules as { client: Module; server: Module };
}

/** Server-renders `name` as a `client:load` island into the document; returns the server's ids. */
async function serve(server: Module, name: string, idPrefix?: string): Promise<string[]> {
  globalThis.ids = [];
  document.body.innerHTML = await renderToString(
    () => island(`/src/id#${name}`, server[name], {}, "load"),
    idPrefix === undefined ? {} : { idPrefix },
  );
  const ids = globalThis.ids;
  globalThis.ids = [];
  return ids;
}

/** Hydrates the document's islands; returns the ids the client computed meanwhile. */
async function hydrateAll(client: Module): Promise<string[]> {
  const manifest: Record<string, () => Promise<unknown>> = {};
  for (const name of Object.keys(client)) {
    manifest[`/src/id#${name}`] = () => Promise.resolve(client[name]);
  }
  loadIslands(manifest);
  for (let i = 0; i < 10; i++) await new Promise((done) => setTimeout(done, 0));
  flush();
  return globalThis.ids;
}

/** The `id`, `for` and `aria-*` attributes of the document, in document order. */
function idAttributes(): string[] {
  const values: string[] = [];
  for (const el of document.body.querySelectorAll("*")) {
    for (const name of ["id", "for", "aria-labelledby", "aria-describedby"]) {
      const value = el.getAttribute(name);
      if (value !== null) values.push(`${name}=${value}`);
    }
  }
  return values;
}

const FIELD = `
  import { signal, useId } from "lumiose";
  export function Field(props: { label: string }) {
    const id = useId();
    const hint = useId();
    globalThis.ids.push(id, hint);
    return (
      <p>
        <label for={id}>{props.label}</label>
        <input id={id} aria-describedby={hint} />
        <small id={hint}>hint</small>
      </p>
    );
  }
  function Group(props: { children?: unknown }) {
    const id = useId();
    globalThis.ids.push(id);
    return <fieldset aria-labelledby={id}><legend id={id}>Group</legend>{props.children}</fieldset>;
  }
`;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  globalThis.ids = [];
});
afterEach(() => {
  warn.mockRestore();
  document.body.textContent = "";
});

describe("useId", () => {
  it("returns the server's ids when an island hydrates, for nested components and children", async () => {
    const { client, server } = await load(`${FIELD}
      export function Form() {
        const id = useId();
        globalThis.ids.push(id);
        return (
          <form aria-labelledby={id}>
            <h2 id={id}>Sign up</h2>
            <Field label="Name" />
            <Group><Field label="Street" /><Field label="City" /></Group>
          </form>
        );
      }`);
    const serverIds = await serve(server, "Form");
    expect(serverIds).toEqual([
      "l0-0-0",
      "l0-0-1-0",
      "l0-0-1-1",
      "l0-0-2-0",
      "l0-0-2-1-0",
      "l0-0-2-1-1",
      "l0-0-2-2-0",
      "l0-0-2-2-1",
    ]);
    const attributes = idAttributes();
    const input = document.querySelector("input")!;
    expect(await hydrateAll(client)).toEqual(serverIds);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("input")).toBe(input);
    expect(idAttributes()).toEqual(attributes);
    // Every id is unique in the page.
    expect(new Set(serverIds).size).toBe(serverIds.length);
  });

  it("matches inside async components, after awaits replay", async () => {
    const { client, server } = await load(`${FIELD}
      export async function Profile() {
        const id = useId();
        globalThis.ids.push(id);
        const name = await Promise.resolve("Ada");
        return <section aria-labelledby={id}><h3 id={id}>{name}</h3><Field label="Bio" /></section>;
      }`);
    const serverIds = await serve(server, "Profile");
    expect(serverIds).toEqual(["l0-0-0", "l0-0-1-0", "l0-0-1-1"]);
    const attributes = idAttributes();
    expect(await hydrateAll(client)).toEqual(serverIds);
    expect(warn).not.toHaveBeenCalled();
    expect(idAttributes()).toEqual(attributes);
  });

  it("gives content rendered later in the browser counter ids", async () => {
    const { client, server } = await load(`${FIELD}
      export function Toggle() {
        const open = signal(false);
        globalThis.open = () => open.set(true);
        return <div><Field label="A" />{open() ? <Field label="B" /> : null}</div>;
      }`);
    const serverIds = await serve(server, "Toggle");
    expect(await hydrateAll(client)).toEqual(serverIds);
    (globalThis as any).open();
    flush();
    const later = globalThis.ids.slice(serverIds.length);
    expect(later).toHaveLength(2);
    for (const id of later) expect(id).toMatch(/^lc\d+$/);
    expect(new Set(globalThis.ids).size).toBe(globalThis.ids.length);
  });

  it("keeps ids in step after a <ViewTransition>, which names its child with one", async () => {
    const { client, server } = await load(`${FIELD}
      import { ViewTransition } from "lumiose";
      export function Card() {
        return <div><ViewTransition><p>card</p></ViewTransition><ViewTransition name="x"><b>b</b></ViewTransition><Field label="A" /></div>;
      }`);
    const serverIds = await serve(server, "Card");
    expect(serverIds).toEqual(["l0-0-2-0", "l0-0-2-1"]);
    expect(await hydrateAll(client)).toEqual(serverIds);
    expect(warn).not.toHaveBeenCalled();
    expect(document.querySelector("p")!.style.getPropertyValue("view-transition-name")).toBe(
      "l0-0-0-0",
    );
    expect(document.querySelector("b")!.style.getPropertyValue("view-transition-name")).toBe("x");
  });

  it("carries the render's idPrefix to the island in the browser", async () => {
    const { client, server } = await load(`${FIELD}
      export function One() { return <Field label="A" />; }`);
    const serverIds = await serve(server, "One", "app1-");
    expect(serverIds).toEqual(["app1-l0-0-0-0", "app1-l0-0-0-1"]);
    expect(document.body.innerHTML).toContain('"idPrefix":"app1-"');
    expect(await hydrateAll(client)).toEqual(serverIds);
    expect(warn).not.toHaveBeenCalled();
  });

  it("numbers ids outside islands by render position, whatever order async content resolves in", async () => {
    const { server } = await load(`${FIELD}
      async function Slow(props: { ms: number; label: string }) {
        await new Promise((done) => setTimeout(done, props.ms));
        return <Field label={props.label} />;
      }
      export function Page(props: { a: number; b: number }) {
        return <main><Field label="top" /><Slow ms={props.a} label="a" /><Slow ms={props.b} label="b" /><Field label="end" /></main>;
      }`);
    const html = async (a: number, b: number, idPrefix?: string) =>
      renderToString(() => server.Page({ a, b }), idPrefix === undefined ? {} : { idPrefix });
    const first = await html(1, 15);
    const second = await html(15, 1);
    expect(second).toBe(first);
    const ids = [...first.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    // An async component's run and its pending output each take a scope.
    expect(ids).toEqual(["ls0", "ls1", "ls2-0", "ls2-1", "ls4-0", "ls4-1", "ls6", "ls7"]);
    expect(await html(1, 15, "x-")).toContain(' id="x-ls2-0"');
  });

  it("keeps ids of streamed boundaries and error fallbacks apart from their siblings", async () => {
    const { server } = await load(`${FIELD}
      import { ErrorBoundary, Suspense } from "lumiose";
      async function Fails(): Promise<unknown> {
        await new Promise((done) => setTimeout(done, 1));
        throw new Error("no");
      }
      export function Page() {
        return (
          <main>
            <Suspense fallback={<p>…</p>}>
              <Field label="in" />
              <ErrorBoundary fallback={() => <Field label="fallback" />}><Fails /></ErrorBoundary>
            </Suspense>
            <Field label="after" />
            <ErrorBoundary fallback={() => <Field label="fallback" />}><Fails /></ErrorBoundary>
          </main>
        );
      }`);
    const all = async (resolveAll: boolean): Promise<string[]> => {
      const shell = await renderToStream(() => server.Page({}), { resolveAll });
      let page = shell.body;
      if (shell.stream !== null) for await (const chunk of shell.stream) page += chunk;
      return [...page.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]!);
    };
    for (const resolveAll of [false, true]) {
      const ids = await all(resolveAll);
      expect(ids).toHaveLength(8);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("uses a counter for client-only renders, with render()'s idPrefix", async () => {
    const { client } = await load(`${FIELD}
      export function App() { return <div><Field label="A" /><Field label="B" /></div>; }`);
    const a = document.createElement("div");
    const b = document.createElement("div");
    const disposeA = render(() => client.App({}), a);
    const disposeB = render(() => client.App({}), b, { idPrefix: "b-" });
    const [a1, a2, a3, a4, b1, b2, b3, b4] = globalThis.ids;
    for (const id of [a1, a2, a3, a4]) expect(id).toMatch(/^lc\d+$/);
    for (const id of [b1, b2, b3, b4]) expect(id).toMatch(/^b-lc\d+$/);
    expect(new Set(globalThis.ids).size).toBe(8);
    expect(a.querySelector("input")!.id).toBe(a1);
    expect(b.querySelector("label")!.htmlFor).toBe(b1);
    disposeA();
    disposeB();
  });

  it("throws on the server outside a render", () => {
    expect(() => serverUseId()).toThrow(/useId\(\) can only be used while rendering/);
  });
});
