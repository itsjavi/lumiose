// @vitest-environment happy-dom
// Execution tests: compile sources with the native compiler, then run the output against the real
// `lumen/dom` runtime (packages/lumen) in happy-dom. A case is skipped when the compiled module
// needs a runtime helper that `lumen/dom` does not export yet (the runtime is developed in
// parallel), so this suite tracks the compiler-runtime contract as both sides grow.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumen/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

// happy-dom replaces the global `URL`, so paths are built with node:path.
const lumenEntry = resolve(import.meta.dirname, "../../lumen/src/index.ts");
const domEntry = resolve(import.meta.dirname, "../../lumen/src/dom/index.ts");
const outDir = resolve(import.meta.dirname, "out");

type Runtime = Record<string, unknown> & {
  mount: (code: () => unknown, container: Element) => () => void;
};
type Lumen = { flushSync: () => void; signal: <T>(v: T) => { (): T; set(v: T): void } };

const dom = (await import(/* @vite-ignore */ domEntry)) as Runtime;
const lumen = (await import(/* @vite-ignore */ lumenEntry)) as Lumen;

let counter = 0;

/** Compiles `source`, points its runtime imports at the workspace sources and imports it. */
async function load(source: string, options: Record<string, unknown> = {}) {
  const result = binding!.compile(source, `/src/case${counter}.tsx`, {
    styleImport: false,
    ...options,
  });
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  expect(errors).toEqual([]);
  const missing = result.meta.runtimeHelpers.filter((name) => !(name in dom));
  const code = result.code
    .replaceAll('from "lumen/dom"', `from ${JSON.stringify(domEntry)}`)
    .replaceAll('from "lumen"', `from ${JSON.stringify(lumenEntry)}`);
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `case${counter++}.js`);
  writeFileSync(file, code);
  const module = missing.length
    ? undefined
    : ((await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, any>);
  return { module, missing, result };
}

function render(component: unknown, props: Record<string, unknown> = {}) {
  const app = document.createElement("div");
  document.body.appendChild(app);
  dom.mount(
    () => (dom.createComponent as (c: unknown, p: unknown) => unknown)(component, props),
    app,
  );
  return app;
}

afterEach(() => {
  document.body.textContent = "";
});

describe.skipIf(!binding)("compiled output runs on lumen/dom", () => {
  it("counter: dynamic text, delegated event, class object (doc-2 §5.1)", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumen";
      export function Counter({ start = 0 }: { start?: number }) {
        const count = signal(start);
        return (
          <button class={{ hot: count() > 5 }} onClick={() => count.update((c) => c + 1)}>
            Clicked {count()} times
          </button>
        );
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.Counter, { start: 4 });
    const button = app.querySelector("button")!;
    expect(button.textContent).toBe("Clicked 4 times");
    button.click();
    lumen.flushSync();
    expect(button.textContent).toBe("Clicked 5 times");
    expect(button.className).toBe("");
    button.click();
    lumen.flushSync();
    expect(button.className).toBe("hot");
  });

  it("keyed list, selector and data-slot events (doc-2 §5.2)", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumen";
      export const rows = signal([1, 2, 3].map((id) => ({ id, label: signal("row " + id) })));
      const selected = signal(0);
      const select = (id: number) => selected.set(id);
      export function Table() {
        return (
          <table>
            <tbody>
              {rows().map((row) => (
                <tr key={row.id} class={{ danger: selected() === row.id }}>
                  <td><a onClick={() => select(row.id)}>{row.label()}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("$$clickData = row");
    const app = render(module.Table);
    const anchors = () => Array.from(app.querySelectorAll("a"));
    expect(anchors().map((a) => a.textContent)).toEqual(["row 1", "row 2", "row 3"]);
    anchors()[1]!.click();
    lumen.flushSync();
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 2");
    module.rows()[1].label.set("row 2 !");
    module.rows.set(module.rows().toReversed());
    lumen.flushSync();
    expect(anchors().map((a) => a.textContent)).toEqual(["row 3", "row 2 !", "row 1"]);
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 2 !");
  });

  it("components: getter props, children and class passthrough (doc-2 §5.3)", async (ctx) => {
    const { module, missing } = await load(
      `
      import { signal } from "lumen";
      export const post = signal({ title: "One", body: "First" });
      function Card(props: { title: string; class?: string; children?: unknown }) {
        return <article class={props.class}><h2>{props.title}</h2>{props.children}</article>;
      }
      export function Page() {
        return <main><Card title={post().title} class="featured">{post().body}</Card></main>;
      }`,
      { scopeTokens: { components: { Page: "data-l-p1", Card: "data-l-c2" } } },
    );
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.Page);
    const article = app.querySelector("article")!;
    expect(article.className).toBe("featured");
    expect(article.hasAttribute("data-l-p1")).toBe(true);
    expect(article.hasAttribute("data-l-c2")).toBe(true);
    expect(article.textContent).toBe("OneFirst");
    module.post.set({ title: "Two", body: "Second" });
    lumen.flushSync();
    expect(article.textContent).toBe("TwoSecond");
  });

  it("props destructuring with defaults and rest", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumen";
      export const label = signal<string | undefined>(undefined);
      function Field({ label = "Name", ...rest }: { label?: string; id?: string }) {
        return <label {...rest}>{label}</label>;
      }
      export function Form() {
        return <form><Field label={label()} id="f" /></form>;
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.Form);
    const label = app.querySelector("label")!;
    expect(label.id).toBe("f");
    expect(label.textContent).toBe("Name");
    module.label.set("Email");
    lumen.flushSync();
    expect(label.textContent).toBe("Email");
    module.label.set(undefined);
    lumen.flushSync();
    expect(label.textContent).toBe("Name");
  });

  it("branches, markers and fragments keep their positions", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumen";
      export const open = signal(false);
      export const a = signal("a");
      export function View() {
        return (
          <>
            <p>before {a()} after</p>
            <div>
              {open() ? <b>on</b> : <i>off</i>}
              {open() && <span>!</span>}
              <hr />
            </div>
          </>
        );
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.View);
    expect(app.querySelector("p")!.textContent).toBe("before a after");
    const div = app.querySelector("div")!;
    expect(div.textContent).toBe("off");
    const off = div.querySelector("i");
    module.open.set(true);
    module.a.set("A");
    lumen.flushSync();
    expect(app.querySelector("p")!.textContent).toBe("before A after");
    expect(div.textContent).toBe("on!");
    expect(div.lastElementChild!.tagName).toBe("HR");
    module.open.set(false);
    lumen.flushSync();
    expect(div.textContent).toBe("off");
    expect(div.querySelector("i")).not.toBe(off);
  });

  it("list rows: components, fragments, reactive conditionals and the index", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumen";
      export const items = signal([{ id: 1, n: "a" }, { id: 2, n: "b" }]);
      export const loud = signal(false);
      function Row(props: { item: { n: string } }) {
        return <li>{props.item.n}</li>;
      }
      export function Lists() {
        return (
          <div>
            <ul>{items().map((item) => <Row key={item.id} item={item} />)}</ul>
            <dl>{items().map((item, i) => <><dt>{item.n}</dt><dd>{i}</dd></>)}</dl>
            <p>{items().map((item) => (loud() ? <b>{item.n}</b> : <i>{item.n}</i>))}</p>
          </div>
        );
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.Lists);
    expect(app.querySelector("ul")!.textContent).toBe("ab");
    expect(app.querySelector("dl")!.innerHTML).toBe("<dt>a</dt><dd>0</dd><dt>b</dt><dd>1</dd>");
    expect(app.querySelector("p")!.innerHTML).toBe("<i>a</i><i>b</i>");
    module.loud.set(true);
    module.items.set(module.items().toReversed());
    lumen.flushSync();
    expect(app.querySelector("ul")!.textContent).toBe("ba");
    expect(app.querySelector("dl")!.textContent).toBe("b0a1");
    expect(app.querySelector("p")!.innerHTML).toBe("<b>b</b><b>a</b>");
  });

  it("two-way bindings, refs, attachments and native listeners", async (ctx) => {
    const { module, missing } = await load(`
      import { signal, ref } from "lumen";
      export const name = signal("Ada");
      export const input = ref<HTMLInputElement>();
      export const log: string[] = [];
      const mark = (el: Element) => { el.setAttribute("data-attached", ""); };
      export function Form() {
        return (
          <input ref={input} bind:value={name} attach={[mark]}
            onMouseEnter={() => log.push("enter")} on:custom-event={() => log.push("custom")} />
        );
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    const app = render(module.Form);
    lumen.flushSync(); // attachments run as effects, after mount
    const element = app.querySelector("input")!;
    expect(module.input()).toBe(element);
    expect(element.value).toBe("Ada");
    expect(element.hasAttribute("data-attached")).toBe(true);
    element.value = "Grace";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    expect(module.name()).toBe("Grace");
    element.dispatchEvent(new Event("mouseenter"));
    element.dispatchEvent(new Event("custom-event"));
    expect(module.log).toEqual(["enter", "custom"]);
  });
});

describe.skipIf(!binding)("async components on lumen/dom", () => {
  it("renders after the awaits resolve, with for await and try/catch", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumen";
      export const id = signal("1");
      async function* parts() { yield "x"; yield "y"; }
      export async function Member(props: { id: string }) {
        const name = await Promise.resolve("Ada " + props.id);
        let failed = "";
        try { await Promise.reject(new Error("no")); } catch (e) { failed = (e as Error).message; }
        const seen: string[] = [];
        for await (const part of parts()) seen.push(part);
        return <h3 title={failed}>{name} {seen.join("")}</h3>;
      }
      export function Page() {
        return <main><Member id={id()} /></main>;
      }`);
    if (!module) return ctx.skip(`lumen/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("$async(async function Member");
    const app = render(module.Page);
    for (let i = 0; i < 20 && !app.querySelector("h3"); i++) {
      await new Promise((done) => setTimeout(done, 1));
      lumen.flushSync();
    }
    const heading = app.querySelector("h3")!;
    expect(heading.textContent).toBe("Ada 1 xy");
    expect(heading.title).toBe("no");
    // A prop change re-runs the component; the new UI replaces the old one when it resolves.
    module.id.set("2");
    lumen.flushSync();
    for (let i = 0; i < 20 && app.querySelector("h3")?.textContent !== "Ada 2 xy"; i++) {
      await new Promise((done) => setTimeout(done, 1));
      lumen.flushSync();
    }
    expect(app.querySelectorAll("h3")).toHaveLength(1);
    expect(app.querySelector("h3")!.textContent).toBe("Ada 2 xy");
  });
});
