// @vitest-environment happy-dom
// Execution tests: compile sources with the native compiler, then run the output against the real
// `lumiose/dom` runtime (packages/lumiose) in happy-dom. A case is skipped when the compiled module
// needs a runtime helper that `lumiose/dom` does not export yet (the runtime is developed in
// parallel), so this suite tracks the compiler-runtime contract as both sides grow.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumiose/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

// happy-dom replaces the global `URL`, so paths are built with node:path.
const lumioseEntry = resolve(import.meta.dirname, "../../lumiose/src/index.ts");
const domEntry = resolve(import.meta.dirname, "../../lumiose/src/dom/index.ts");
const outDir = resolve(import.meta.dirname, "out");

type Runtime = Record<string, unknown> & {
  render: (code: () => unknown, container: Element) => () => void;
};
type Lumiose = { flush: () => void; signal: <T>(v: T) => { (): T; set(v: T): void } };

const dom = (await import(/* @vite-ignore */ domEntry)) as Runtime;
const lumiose = (await import(/* @vite-ignore */ lumioseEntry)) as Lumiose;

let counter = 0;

/** Compiles `source`, points its runtime imports at the workspace sources and imports it. */
async function load(source: string, options: Record<string, unknown> = {}) {
  const extension = source.includes("<style") ? "stsx" : "tsx";
  const result = binding!.compile(source, `/src/case${counter}.${extension}`, {
    styleImport: false,
    ...options,
  });
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  expect(errors).toEqual([]);
  const missing = result.meta.runtimeHelpers.filter((name) => !(name in dom));
  const code = result.code
    .replaceAll('from "lumiose/dom"', `from ${JSON.stringify(domEntry)}`)
    .replaceAll('from "lumiose"', `from ${JSON.stringify(lumioseEntry)}`);
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
  dom.render(
    () => (dom.createComponent as (c: unknown, p: unknown) => unknown)(component, props),
    app,
  );
  return app;
}

afterEach(() => {
  document.body.textContent = "";
});

describe.skipIf(!binding)("compiled output runs on lumiose/dom", () => {
  it("counter: dynamic text, delegated event, class object (doc-2 §5.1)", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export function Counter({ start = 0 }: { start?: number }) {
        const count = signal(start);
        return (
          <button class={{ hot: count() > 5 }} onClick={() => count.update((c) => c + 1)}>
            Clicked {count()} times
          </button>
        );
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Counter, { start: 4 });
    const button = app.querySelector("button")!;
    expect(button.textContent).toBe("Clicked 4 times");
    button.click();
    lumiose.flush();
    expect(button.textContent).toBe("Clicked 5 times");
    expect(button.className).toBe("");
    button.click();
    lumiose.flush();
    expect(button.className).toBe("hot");
  });

  it("text children alone between nodes are text nodes (TASK-65)", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumiose";
      export const n = signal(3);
      export function Texts(props: { a: string }) {
        const label = String(props.a);
        return <div><b>x</b>{n() * 2}<i />{label}<hr />{\`\${props.a}!\`}</div>;
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("setText");
    expect(result.code).not.toContain("insert(");
    const app = render(module.Texts, { a: "A" });
    const div = app.querySelector("div")!;
    expect([...div.childNodes].map((node) => node.nodeName)).toEqual([
      "B",
      "#text",
      "I",
      "#text",
      "HR",
      "#text",
    ]);
    expect(div.textContent).toBe("x6AA!");
    module.n.set(5);
    lumiose.flush();
    expect(div.textContent).toBe("x10AA!");
  });

  it("keyed list, selector and data-slot events (doc-2 §5.2)", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumiose";
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
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("$$clickData = row");
    const app = render(module.Table);
    const anchors = () => Array.from(app.querySelectorAll("a"));
    expect(anchors().map((a) => a.textContent)).toEqual(["row 1", "row 2", "row 3"]);
    anchors()[1]!.click();
    lumiose.flush();
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 2");
    module.rows()[1].label.set("row 2 !");
    module.rows.set(module.rows().toReversed());
    lumiose.flush();
    expect(anchors().map((a) => a.textContent)).toEqual(["row 3", "row 2 !", "row 1"]);
    expect(app.querySelector("tr.danger")!.textContent).toBe("row 2 !");
  });

  it("components: getter props, children and class passthrough (doc-2 §5.3)", async (ctx) => {
    const { module, missing, result } = await load(
      `
      import { signal } from "lumiose";
      export const post = signal({ title: "One", body: "First" });
      function Card(props: { title: string; class?: string; children?: unknown }) {
        return <article class={props.class}><h2>{props.title}</h2>{props.children}<style>h2 { margin: 0 }</style></article>;
      }
      export function Page() {
        return <main><Card title={post().title} class="featured">{post().body}</Card><style>.featured { color: teal }</style></main>;
      }`,
    );
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const [Page, Card] = ["Page", "Card"].map(
      (name) => result.meta.scopeTokens.components[name]![0]!.attribute,
    );
    const app = render(module.Page);
    const article = app.querySelector("article")!;
    expect(article.className).toBe("featured");
    // Its own token, and the caller's through class passthrough.
    expect(article.hasAttribute(Card!)).toBe(true);
    expect(article.hasAttribute(Page!)).toBe(true);
    expect(app.querySelector("main")!.hasAttribute(Card!)).toBe(false);
    expect(article.textContent).toBe("OneFirst");
    module.post.set({ title: "Two", body: "Second" });
    lumiose.flush();
    expect(article.textContent).toBe("TwoSecond");
  });

  it("table rows go in the implicit tbody; a select value is set once its options exist", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      // String values: happy-dom's select.value setter does not convert numbers.
      export const items = signal([{ id: "1", label: "One" }, { id: "2", label: "Two" }]);
      export const choice = signal("2");
      export function Pick() {
        return (
          <form>
            <table>{items().map((item) => <tr><td>{item.label}</td></tr>)}</table>
            <select value={choice()}>{items().map((item) => <option value={item.id}>{item.label}</option>)}</select>
          </form>
        );
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Pick);
    expect(app.querySelectorAll("table > tbody > tr")).toHaveLength(2);
    const select = app.querySelector("select")!;
    expect(select.value).toBe("2");
    module.choice.set("1");
    lumiose.flush();
    expect(select.value).toBe("1");
    module.items.set([...module.items(), { id: "3", label: "Three" }]);
    lumiose.flush();
    expect(app.querySelectorAll("table > tbody > tr")).toHaveLength(3);
  });

  it("props destructuring with defaults and rest", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export const label = signal<string | undefined>(undefined);
      function Field({ label = "Name", ...rest }: { label?: string; id?: string }) {
        return <label {...rest}>{label}</label>;
      }
      export function Form() {
        return <form><Field label={label()} id="f" /></form>;
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Form);
    const label = app.querySelector("label")!;
    expect(label.id).toBe("f");
    expect(label.textContent).toBe("Name");
    module.label.set("Email");
    lumiose.flush();
    expect(label.textContent).toBe("Email");
    module.label.set(undefined);
    lumiose.flush();
    expect(label.textContent).toBe("Name");
  });

  it("branches, markers and fragments keep their positions", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
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
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.View);
    expect(app.querySelector("p")!.textContent).toBe("before a after");
    const div = app.querySelector("div")!;
    expect(div.textContent).toBe("off");
    const off = div.querySelector("i");
    module.open.set(true);
    module.a.set("A");
    lumiose.flush();
    expect(app.querySelector("p")!.textContent).toBe("before A after");
    expect(div.textContent).toBe("on!");
    expect(div.lastElementChild!.tagName).toBe("HR");
    module.open.set(false);
    lumiose.flush();
    expect(div.textContent).toBe("off");
    expect(div.querySelector("i")).not.toBe(off);
  });

  it("list rows: components, fragments, reactive conditionals and the index", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
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
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Lists);
    expect(app.querySelector("ul")!.textContent).toBe("ab");
    expect(app.querySelector("dl")!.innerHTML).toBe("<dt>a</dt><dd>0</dd><dt>b</dt><dd>1</dd>");
    expect(app.querySelector("p")!.innerHTML).toBe("<i>a</i><i>b</i>");
    module.loud.set(true);
    module.items.set(module.items().toReversed());
    lumiose.flush();
    expect(app.querySelector("ul")!.textContent).toBe("ba");
    expect(app.querySelector("dl")!.textContent).toBe("b0a1");
    expect(app.querySelector("p")!.innerHTML).toBe("<b>b</b><b>a</b>");
  });

  it("parentless branches and lists: children, fragments, nested ternaries, returns", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumiose";
      export const open = signal(false);
      export const mode = signal("a");
      export const items = signal([{ id: 1, n: "a" }, { id: 2, n: "b" }]);
      function Box(props: { children?: JSX.Element }) {
        return <section>{props.children}</section>;
      }
      function Switch(props: { on: boolean }) {
        return props.on ? <b>on</b> : <i>off</i>;
      }
      function Frag() {
        return (
          <>
            {open() && <em>!</em>}
            {items().map((item) => <span key={item.id}>{item.n}</span>)}
            <hr />
          </>
        );
      }
      export function View() {
        return (
          <div>
            <Box>{open() ? <b>open</b> : <i>closed</i>}</Box>
            <Box><h2>T</h2>{items().map((item) => <li key={item.id}>{item.n}</li>)}</Box>
            <p>{mode() === "a" ? <b>A</b> : mode() === "b" ? <i>B</i> : <u>C</u>}</p>
            <Switch on={open()} />
            <nav><Frag /></nav>
          </div>
        );
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("branchValue(");
    expect(result.code).toContain("listValue(");
    const app = render(module.View);
    const [box, listBox] = Array.from(app.querySelectorAll("section"));
    const p = app.querySelector("p")!;
    const nav = app.querySelector("nav")!;
    expect(box!.innerHTML).toBe("<i>closed</i>");
    expect(listBox!.innerHTML).toBe("<h2>T</h2><li>a</li><li>b</li>");
    expect(p.innerHTML).toBe("<b>A</b>");
    expect(app.querySelector("div > i")!.textContent).toBe("off");
    expect(nav.innerHTML).toBe("<span>a</span><span>b</span><hr>");
    const closed = box!.firstElementChild;
    const [liA, liB] = Array.from(listBox!.querySelectorAll("li"));
    const spanA = nav.querySelector("span");

    // Memoised on the condition: an unrelated write keeps the rendered branch.
    module.mode.set("b");
    lumiose.flush();
    expect(p.innerHTML).toBe("<i>B</i>");
    expect(box!.firstElementChild).toBe(closed);
    module.mode.set("c");
    lumiose.flush();
    expect(p.innerHTML).toBe("<u>C</u>");

    module.open.set(true);
    module.items.set(module.items().toReversed());
    lumiose.flush();
    expect(box!.innerHTML).toBe("<b>open</b>");
    expect(app.querySelector("div > b:not(p b)")!.textContent).toBe("on");
    // Keyed: rows move instead of being re-created.
    expect(Array.from(listBox!.querySelectorAll("li"))).toEqual([liB, liA]);
    expect(listBox!.innerHTML).toBe("<h2>T</h2><li>b</li><li>a</li>");
    expect(nav.innerHTML).toBe("<em>!</em><span>b</span><span>a</span><hr>");
    expect(nav.querySelectorAll("span")[1]).toBe(spanA);
  });

  it("two-way bindings, refs, attachments and native listeners", async (ctx) => {
    const { module, missing } = await load(`
      import { signal, ref } from "lumiose";
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
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Form);
    lumiose.flush(); // attachments run as effects, after render
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

/** Attributes named `attach`, or holding a function's source, anywhere under `root`. */
function functionAttributes(root: Element): string[] {
  return Array.from(root.querySelectorAll("*")).flatMap((el) =>
    Array.from(el.attributes)
      .filter((a) => a.name === "attach" || a.value.includes("=>"))
      .map((a) => `${el.localName} ${a.name}="${a.value}"`),
  );
}

describe.skipIf(!binding)("directives next to a spread (TASK-568)", () => {
  it("runs attach, ref, bind:value and handlers written next to a spread, in either order", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export const name = signal("Ada");
      export const extra = signal<Record<string, unknown>>({ title: "a" });
      export const log: string[] = [];
      const mark = (label: string) => (el: Element) => { log.push(label + " " + el.localName); };
      export function Row(props: { item: string; i: number; itemProps?: (item: string) => object }) {
        return <li {...props.itemProps?.(props.item)} data-row={props.i} attach={[(el) => mark("row")(el)]} />;
      }
      export function Form() {
        return (
          <input attach={[mark("before")]} {...extra()} ref={(el) => log.push("ref " + el.localName)}
            bind:value={name} onClick={() => log.push("click")} on:custom-event={() => log.push("custom")} />
        );
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const row = render(module.Row, {
      item: "a",
      i: 0,
      itemProps: (item: string) => ({ id: item }),
    });
    // Without `itemProps` the spread is undefined: nothing to apply, and no throw (TASK-569).
    const bare = render(module.Row, { item: "b", i: 1 });
    const form = render(module.Form);
    lumiose.flush(); // attachments run as effects, after render
    expect(row.innerHTML).toBe('<li id="a" data-row="0"></li>');
    expect(bare.innerHTML).toBe('<li data-row="1"></li>');
    const input = form.querySelector("input")!;
    expect(module.log).toEqual(["ref input", "row li", "row li", "before input"]);
    expect(input.value).toBe("Ada");
    expect(input.title).toBe("a");
    input.value = "Grace";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(module.name()).toBe("Grace");
    input.click();
    input.dispatchEvent(new Event("custom-event"));
    expect(module.log.slice(4)).toEqual(["click", "custom"]);
    // A spread update leaves the written attachment alone.
    module.extra.set({ title: "b" });
    lumiose.flush();
    expect(input.title).toBe("b");
    expect(module.log.filter((entry: string) => entry === "before input")).toHaveLength(1);
    for (const root of [row, bare, form]) expect(functionAttributes(root)).toEqual([]);
  });

  it("applies a spread's own attach, next to a written one, and never as an attribute", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export const log: string[] = [];
      export const on = signal(true);
      const mark = (label: string) => (el: Element) => {
        log.push(label + " " + el.localName);
        return () => log.push("stop " + label);
      };
      function Item(props: Record<string, unknown>) {
        return <p {...props} attach={[mark("own")]} data-cb={() => 1} />;
      }
      export function Page() {
        return <Item id="f" attach={on() ? [mark("forwarded")] : undefined} />;
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Page);
    lumiose.flush();
    expect(app.innerHTML).toBe('<p id="f"></p>');
    expect(module.log.toSorted()).toEqual(["forwarded p", "own p"]);
    // The forwarded list going away stops its attachments; the written one keeps running.
    module.on.set(false);
    lumiose.flush();
    expect(module.log.slice(2)).toEqual(["stop forwarded"]);
    expect(functionAttributes(app)).toEqual([]);
  });
});

describe.skipIf(!binding)("bind: on components and custom elements (TASK-360)", () => {
  it("passes x and onXChange to a component, and calls an onXChange written next to it", async (ctx) => {
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export const open = signal(false);
      export const log: string[] = [];
      function Disclosure(props: { open?: boolean; onOpenChange?: (open: boolean, reason: string) => void }) {
        return <button onClick={() => props.onOpenChange?.(!props.open, "click")}>{props.open ? "open" : "closed"}</button>;
      }
      export function Page() {
        return <Disclosure bind:open={open} onOpenChange={(next, reason) => log.push(\`\${next} \${reason}\`)} />;
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Page);
    const button = app.querySelector("button")!;
    expect(button.textContent).toBe("closed");
    button.click();
    lumiose.flush();
    expect(module.open()).toBe(true);
    expect(button.textContent).toBe("open");
    expect(module.log).toEqual(["true click"]);
    module.open.set(false);
    lumiose.flush();
    expect(button.textContent).toBe("closed");
  });

  it("sets a custom element's property and reads it back on its change events", async (ctx) => {
    class Toggle extends HTMLElement {
      pressed = false;
    }
    if (!customElements.get("x-toggle")) customElements.define("x-toggle", Toggle);
    const { module, missing } = await load(`
      import { signal } from "lumiose";
      export const pressed = signal(true);
      export function Page(props: Record<string, unknown>) {
        return <x-toggle {...props} bind:pressed={pressed} />;
      }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    const app = render(module.Page, { title: "Bold" });
    const toggle = app.querySelector("x-toggle") as Toggle;
    expect(toggle.pressed).toBe(true);
    expect(toggle.getAttribute("title")).toBe("Bold");
    toggle.pressed = false;
    toggle.dispatchEvent(new Event("pressedchange"));
    expect(module.pressed()).toBe(false);
    module.pressed.set(true);
    lumiose.flush();
    expect(toggle.pressed).toBe(true);
  });
});

describe.skipIf(!binding)("async components on lumiose/dom", () => {
  it("renders after the awaits resolve, with for await and try/catch", async (ctx) => {
    const { module, missing, result } = await load(`
      import { signal } from "lumiose";
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
      }
      // Declarations stay hoisted: usable (and already tagged) before their position.
      export const early = Late;
      async function Late() { return <i />; }`);
    if (!module) return ctx.skip(`lumiose/dom lacks ${missing.join(", ")}`);
    expect(result.code).toContain("export async function Member(props)");
    expect(result.code).toContain("$async(Member);");
    expect(module.early).toBe(module.early);
    expect((module.early as { $$async?: unknown }).$$async).toBeTypeOf("function");
    const app = render(module.Page);
    for (let i = 0; i < 20 && !app.querySelector("h3"); i++) {
      await new Promise((done) => setTimeout(done, 1));
      lumiose.flush();
    }
    const heading = app.querySelector("h3")!;
    expect(heading.textContent).toBe("Ada 1 xy");
    expect(heading.title).toBe("no");
    // A prop change re-runs the component; the new UI replaces the old one when it resolves.
    module.id.set("2");
    lumiose.flush();
    for (let i = 0; i < 20 && app.querySelector("h3")?.textContent !== "Ada 2 xy"; i++) {
      await new Promise((done) => setTimeout(done, 1));
      lumiose.flush();
    }
    expect(app.querySelectorAll("h3")).toHaveLength(1);
    expect(app.querySelector("h3")!.textContent).toBe("Ada 2 xy");
  });
});
