// @vitest-environment happy-dom
// Server target: compile sources with `target: "server"`, render them with `renderToString` on the
// real `lumen/server` runtime and compare the HTML; then compile the same sources for the client,
// mount them on `lumen/dom` and check that the browser's parse of the server HTML is the client's
// DOM (parity, without the client's `<!>` placeholders, which only exist in templates).
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumen/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "../../lumen/src");
const entries = {
  "lumen/server": resolve(src, "server/index.ts"),
  "lumen/dom": resolve(src, "dom/index.ts"),
  lumenServer: resolve(src, "index.server.ts"),
  lumenClient: resolve(src, "index.ts"),
};
const outDir = resolve(import.meta.dirname, "out");

type Module = Record<string, any>;
type Server = {
  createComponent: (c: unknown, p: unknown) => unknown;
  renderToString: (root: () => unknown) => Promise<string>;
};
type Dom = {
  createComponent: (c: unknown, p: unknown) => unknown;
  mount: (code: () => unknown, container: Element) => () => void;
};

const server = (await import(/* @vite-ignore */ entries["lumen/server"])) as Server;
const dom = (await import(/* @vite-ignore */ entries["lumen/dom"])) as Dom;

let counter = 0;

/** Compiles `source` for `target`, points its imports at the workspace sources and imports it. */
async function load(
  source: string,
  target: "client" | "server",
  options: Record<string, unknown> = {},
): Promise<{
  module: Module;
  code: string;
  tokens: Record<string, string>;
  scopes: Record<string, Array<{ attribute: string }>>;
}> {
  const extension = source.includes("<style") ? "stsx" : "tsx";
  // One module id for every case: scope tokens (hashes of the id) then match across targets.
  const result = binding!.compile(source, `/src/ssr.${extension}`, {
    target,
    styleImport: false,
    ...options,
  });
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  expect(errors).toEqual([]);
  const runtime = target === "server" ? "lumen/server" : "lumen/dom";
  const lumen = target === "server" ? entries.lumenServer : entries.lumenClient;
  const code = result.code
    .replaceAll(`from "${runtime}"`, `from ${JSON.stringify(entries[runtime])}`)
    .replaceAll('from "lumen"', `from ${JSON.stringify(lumen)}`);
  mkdirSync(outDir, { recursive: true });
  const file = resolve(outDir, `ssr${counter++}.${target}.js`);
  writeFileSync(file, code);
  return {
    module: await import(/* @vite-ignore */ pathToFileURL(file).href),
    code: result.code,
    // Each component's first subtree scope (its only one in these cases).
    tokens: Object.fromEntries(
      Object.entries(result.meta.scopeTokens.components).map(([name, [first]]) => [
        name,
        first!.attribute,
      ]),
    ),
    scopes: result.meta.scopeTokens.components,
  };
}

async function renderServer(module: Module, name: string, props: Record<string, unknown> = {}) {
  return server.renderToString(() => server.createComponent(module[name], props));
}

function mountClient(module: Module, name: string, props: Record<string, unknown> = {}) {
  const app = document.createElement("div");
  document.body.appendChild(app);
  dom.mount(() => dom.createComponent(module[name], props), app);
  return app;
}

/**
 * Serialized DOM without comments (the client's `<!>` placeholders), with form state as
 * attributes (the client sets properties, the server writes attributes), styles as parsed and
 * attributes sorted (their order is not significant).
 */
function normalized(root: Element, parsedHtml = false): string {
  const walker = document.createTreeWalker(root, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode!.removeChild(comment);
  root.normalize();
  for (const input of root.querySelectorAll("input")) {
    const { value, checked } = input;
    input.setAttribute("value", value);
    input.toggleAttribute("checked", checked);
  }
  for (const textarea of root.querySelectorAll("textarea")) {
    textarea.textContent = textarea.value;
  }
  // The client selects options through select.value; parsed server HTML keeps its `selected`
  // attributes (happy-dom's parser does not always apply them to select.value).
  if (!parsedHtml) {
    for (const select of root.querySelectorAll("select")) {
      const { value } = select;
      for (const option of select.querySelectorAll("option")) {
        option.toggleAttribute("selected", option.value === value);
      }
    }
  }
  for (const el of root.querySelectorAll("*")) {
    if (el.hasAttribute("style")) el.setAttribute("style", (el as HTMLElement).style.cssText);
    const attributes = Array.from(el.attributes, (a) => [a.name, a.value] as const);
    for (const [name] of attributes) el.removeAttribute(name);
    for (const [name, value] of attributes.toSorted(([a], [b]) => a.localeCompare(b))) {
      el.setAttribute(name, value);
    }
  }
  return root.innerHTML;
}

function parsed(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  return normalized(container, true);
}

/** Compiles `source` for both targets and expects the same DOM for each component. */
async function expectParity(
  source: string,
  cases: Array<[name: string, props?: Record<string, unknown>]>,
  options: Record<string, unknown> = {},
) {
  const serverModule = (await load(source, "server", options)).module;
  const clientModule = (await load(source, "client", options)).module;
  for (const [name, props = {}] of cases) {
    const html = await renderServer(serverModule, name, props);
    const app = mountClient(clientModule, name, props);
    expect(parsed(html), name).toBe(normalized(app));
  }
}

afterEach(() => {
  document.body.textContent = "";
});

const COUNTER = `
  import { signal } from "lumen";
  export function Counter({ start = 0 }: { start?: number }) {
    const count = signal(start);
    return (
      <button class={{ hot: count() > 5 }} onClick={() => count.update((c) => c + 1)}>
        Clicked {count()} times
      </button>
    );
  }`;

const TABLE = `
  import { signal } from "lumen";
  const rows = signal([1, 2, 3].map((id) => ({ id, label: signal("row " + id) })));
  const selected = signal(2);
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
  }`;

const CARD = `
  import { signal } from "lumen";
  const post = signal({ title: "One", body: "First <b>" });
  function Card(props: { title: string; class?: string; children?: unknown }) {
    return <article class={props.class}><h2>{props.title}</h2>{props.children}<style>h2 { margin: 0 }</style></article>;
  }
  export function Page() {
    return <main><Card title={post().title} class="featured">{post().body}</Card><style>.featured { color: teal }</style></main>;
  }`;

// decision-23: the nested block's token is only on its enclosing element's subtree.
const NESTED_STYLES = `
  function Card(props: { class?: string }) {
    return <b class={props.class}>card<style>b { margin: 0 }</style></b>;
  }
  export function Tree() {
    return (
      <section>
        <p class="c1">one</p>
        <div><p class="c2">two</p><Card class="pass" /><style>.c2, .pass { color: red }</style></div>
        <style>section { display: grid }</style>
      </section>
    );
  }`;

// TASK-92: a class forwarded through a middle component keeps the original caller's scope.
const CLASS_FORWARDING = `
  function Inner(props: { class?: unknown }) {
    return <span class={props.class}>inner</span>;
  }
  function Middle(props: { class?: string }) {
    return <div><Inner class={["mid", props.class]} /><style>.mid { color: teal }</style></div>;
  }
  function Plain({ class: cls }: { class?: string }) {
    return <Inner class={cls} />;
  }
  export function Outer() {
    return (
      <main>
        <Middle class="cta" />
        <Plain class="cta" />
        <style>.cta { font-weight: bold }</style>
      </main>
    );
  }`;

// TASK-65: provably text children alone between nodes are text nodes (setText or a one-time
// write) on the client and text() holes on the server; the others stay inserts.
const TEXT_CHILDREN = `
  import { signal } from "lumen";
  const n = signal(3);
  export function Texts(props: { a: string; icon?: unknown }) {
    const label = String(props.a);
    return (
      <div>
        <b>x</b>
        {n() * 2}
        <i />
        {label}
        <hr />
        {\`\${props.a}!\`}
        <p>
          <br />
          {props.icon}
          <br />
          {n()}{n() + 1} and {label}
        </p>
      </div>
    );
  }`;

const ATTRIBUTES = `
  import { signal } from "lumen";
  const name = signal('Ada "the" <first>');
  const on = signal(true);
  export function Attributes(props: { size: number }) {
    return (
      <form title={name()} data-size={props.size} aria-busy={on()} hidden={!on()}>
        <input value={name()} disabled={on()} readonly={false} onInput={() => {}} />
        <input type="checkbox" checked={on()} />
        <input bind:value={name} />
        <p class={{ base: true, on: on(), off: !on() }} style={{ color: "red", width: props.size + "px" }} />
        <p class={["a", on() && "b"]} style={on() ? "margin: 0" : undefined} />
        <div innerHTML={"<i>" + props.size + "</i>"} />
        <span textContent={name()} />
        <textarea value={name()} />
        <label>{name()}</label>
        <b>{\`<\${props.size}>\`}</b>
      </form>
    );
  }`;

const STRUCTURE = `
  import { signal } from "lumen";
  const open = signal(true);
  const items = signal(["a", "b", "c"]);
  function Item(props: { label: string; index: number }) {
    return <li data-index={props.index}>{props.label}</li>;
  }
  export function Structure({ title = "Untitled", ...rest }: { title?: string; id?: string }) {
    return (
      <section {...rest} class="box">
        <h1>{title}</h1>
        <p>before {items().length} middle {open() ? "yes" : "no"} after</p>
        {open() ? <b>open</b> : <i>closed</i>}
        {open() && <span>!</span>}
        <ul>{items().map((item, i) => <Item label={item} index={i} />)}</ul>
        <ol>{items().map((item, i) => <><li>{item}</li><li>{i}</li></>)}</ol>
        <table>
          <tr><td>{title}</td></tr>
        </table>
        <>
          text {items()[0]} <hr />
        </>
      </section>
    );
  }
  export const Fragment = () => (
    <>
      <h2>Heading</h2>
      {items().join("-")}
      <Item label="last" index={9} />
    </>
  );`;

const TABLE_SELECT = `
  import { signal } from "lumen";
  const items = signal([{ id: 1, label: "One" }, { id: 2, label: "Two" }]);
  const open = signal(true);
  export function Pick(props: { choice: number }) {
    return (
      <form>
        <table>
          {items().map((item) => <tr><td>{item.label}</td></tr>)}
          {open() && <tr><td>open</td></tr>}
        </table>
        <select value={props.choice}>
          {items().map((item) => <option value={item.id}>{item.label}</option>)}
          <option>Three</option>
        </select>
      </form>
    );
  }`;

describe.skipIf(!binding)("server target renders on lumen/server", () => {
  it("counter (doc-2 §5.1)", async () => {
    const { module, code } = await load(COUNTER, "server");
    expect(code).toContain("ssr(_s0, classAttr({ hot: count() > 5 }), insert(count()))");
    expect(await renderServer(module, "Counter", { start: 4 })).toBe(
      "<button>Clicked 4 times</button>",
    );
    expect(await renderServer(module, "Counter", { start: 7 })).toBe(
      '<button class="hot">Clicked 7 times</button>',
    );
  });

  it("keyed list with selector, events dropped (doc-2 §5.2)", async () => {
    const { module, code } = await load(TABLE, "server");
    expect(code).not.toContain("onClick");
    expect(code).not.toContain("select(row.id)");
    expect(await renderServer(module, "Table")).toBe(
      "<table><tbody>" +
        "<tr><td><a>row 1</a></td></tr>" +
        '<tr class="danger"><td><a>row 2</a></td></tr>' +
        "<tr><td><a>row 3</a></td></tr>" +
        "</tbody></table>",
    );
  });

  it("component call with getter props, children and class passthrough (doc-2 §5.3)", async () => {
    const { module, tokens } = await load(CARD, "server");
    const { Page, Card } = tokens;
    expect(await renderServer(module, "Page")).toBe(
      `<main ${Page}><article ${Card} class="featured" ${Page}>` +
        `<h2 ${Card}>One</h2>First &lt;b></article></main>`,
    );
  });

  it("nested style blocks scope to their enclosing element's subtree (decision-23)", async () => {
    const { module, scopes } = await load(NESTED_STYLES, "server");
    const [root, nested] = scopes.Tree!.map((scope) => scope.attribute);
    const card = scopes.Card![0]!.attribute;
    expect(await renderServer(module, "Tree")).toBe(
      `<section ${root}><p class=c1 ${root}>one</p><div ${root} ${nested}>` +
        `<p class=c2 ${root} ${nested}>two</p><b ${card} class="pass" ${root} ${nested}>card</b>` +
        `</div></section>`,
    );
  });

  it("a class forwarded through a middle component keeps the caller's scope (TASK-92)", async () => {
    const { module, tokens } = await load(CLASS_FORWARDING, "server");
    const { Outer, Middle } = tokens;
    expect(await renderServer(module, "Outer")).toBe(
      `<main ${Outer}><div ${Middle}><span class="mid cta" ${Middle} ${Outer}>inner</span></div>` +
        `<span class="cta" ${Outer}>inner</span></main>`,
    );
  });

  it("attributes, properties and escaping", async () => {
    const { module } = await load(ATTRIBUTES, "server");
    expect(await renderServer(module, "Attributes", { size: 3 })).toBe(
      // The runtime escapes `&` and `<` in text, `&` and `"` in attribute values (TASK-71).
      '<form title="Ada &quot;the&quot; <first>" data-size="3" aria-busy="true">' +
        '<input value="Ada &quot;the&quot; <first>" disabled>' +
        "<input type=checkbox checked>" +
        '<input value="Ada &quot;the&quot; <first>">' +
        '<p class="base on" style="color:red;width:3px"></p>' +
        '<p class="a b" style="margin: 0"></p>' +
        "<div><i>3</i></div>" +
        '<span>Ada "the" &lt;first></span>' +
        '<textarea>Ada "the" &lt;first></textarea>' +
        '<label>Ada "the" &lt;first></label>' +
        "<b>&lt;3></b>" +
        "</form>",
    );
  });

  it("rows of a table go in the implicit tbody; select values mark their option", async () => {
    const { module } = await load(TABLE_SELECT, "server");
    expect(await renderServer(module, "Pick", { choice: 2 })).toBe(
      "<form><table><tbody><tr><td>One</td></tr><tr><td>Two</td></tr><tr><td>open</td></tr></tbody></table>" +
        '<select><option value="1">One</option><option value="2" selected>Two</option><option>Three</option></select></form>',
    );
    expect(await renderServer(module, "Pick", { choice: "Three" })).toContain(
      "<option selected>Three</option>",
    );
  });

  it("branches, lists, fragments, spreads and the implicit tbody", async () => {
    const { module } = await load(STRUCTURE, "server");
    expect(await renderServer(module, "Structure", { id: "s1" })).toBe(
      '<section id="s1" class="box">' +
        "<h1>Untitled</h1>" +
        "<p>before 3 middle yes after</p>" +
        "<b>open</b><span>!</span>" +
        '<ul><li data-index="0">a</li><li data-index="1">b</li><li data-index="2">c</li></ul>' +
        "<ol><li>a</li><li>0</li><li>b</li><li>1</li><li>c</li><li>2</li></ol>" +
        "<table><tbody><tr><td>Untitled</td></tr></tbody></table>" +
        "text a <hr>" +
        "</section>",
    );
    expect(await renderServer(module, "Fragment")).toBe(
      '<h2>Heading</h2>a-b-c<li data-index="9">last</li>',
    );
  });
});

const ASYNC = `
  const wait = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 1));
  async function* lines() {
    yield "a";
    yield "";
    yield "b";
  }
  export async function Member({ id }: { id: string }) {
    const member = await wait({ name: "Ada " + id });
    let error = "";
    try {
      await Promise.reject(new Error("boom"));
    } catch (e) {
      error = (e as Error).message;
    }
    const seen: string[] = [];
    for await (const line of lines()) {
      if (line === "") continue;
      seen.push(line);
    }
    return <h3 title={error}>{member.name} {seen.join(",")}</h3>;
  }
  export const Team = async () => <section><Member id="1" /><Member id="2" /></section>;`;

const ISLANDS = `
  export function Panel(props: { ids: number[]; children?: unknown; footer?: unknown }) {
    return <div class="panel">{props.ids.join("+")}{props.footer}{props.children}</div>;
  }
  export async function Slow({ n }: { n: number }) {
    const value = await Promise.resolve(n * 2);
    return <b>{value}</b>;
  }
  export function Page() {
    return (
      <main>
        <Panel client:load ids={[1, 2]} footer={<i>foot</i>}>
          <p>child</p>
        </Panel>
        <Slow client:visible="100px" n={21} />
      </main>
    );
  }`;

describe.skipIf(!binding)("async components and islands (server)", () => {
  it("async components await through $await and keep their frames", async () => {
    const { module, code } = await load(ASYNC, "server");
    expect(code).toContain("$async(Member);");
    expect(code).toContain("export async function Member(props)");
    expect(code).toContain("(await $await(() => wait(");
    expect(await renderServer(module, "Team")).toBe(
      '<section><h3 title="boom">Ada 1 a,b</h3><h3 title="boom">Ada 2 a,b</h3></section>',
    );
  });

  it("island call sites render ranges, slots and records", async () => {
    const { module, code } = await load(ISLANDS, "server");
    expect(code).toMatch(
      /island\("\/src\/ssr\.tsx#Panel", Panel, \{ ids: \[1, 2\] \}, "load", void 0, \{/,
    );
    const html = await renderServer(module, "Page");
    const [body, records] = html.split('<script type="application/json" data-l-islands>');
    expect(body).toBe(
      "<main>" +
        // Slots the island renders are inline (`<!--l:s:name-->`); an async instance is a block.
        "<!--l:0--><div class=panel><!--[-->1+2<!--]-->" +
        "<!--[--><!--l:s:footer--><i>foot</i><!--/l:s--><!--]-->" +
        "<!--[--><!--l:s:children--><p>child</p><!--/l:s--><!--]--></div><!--/l:0-->" +
        "<!--l:1--><!--[--><b><!--[-->42<!--]--></b><!--]--><!--/l:1-->" +
        "</main>",
    );
    const recorded = JSON.parse(records!.slice(0, records!.indexOf("</script>")));
    expect(recorded).toMatchObject([
      { id: 0, strategy: "load", props: { ids: [1, 2] }, slots: ["footer", "children"] },
      { id: 1, strategy: "visible", value: "100px", props: { n: 21 }, awaits: { "0:0:0": 42 } },
    ]);
    expect(recorded[0].ref).toMatch(/^\/src\/ssr\.tsx#Panel$/);
  });
});

describe.skipIf(!binding)("hydration markers are decided at runtime", () => {
  it("inside an island, every client insert/list/branch position is one region", async () => {
    const { module } = await load(STRUCTURE, "server");
    const island = (server as unknown as Record<string, Function>).island!;
    const html = await server.renderToString(() =>
      island("/src/s#Structure", module.Structure, { id: "s1" }, "load"),
    );
    const [body] = html.split("<script");
    expect(body).toBe(
      '<!--l:0--><section id="s1" class="box">' +
        "<h1><!--[-->Untitled<!--]--></h1>" +
        "<p>before <!--[-->3<!--]--> middle <!--[-->yes<!--]--> after</p>" +
        "<!--[--><b>open</b><!--]--><!--[--><span>!</span><!--]-->" +
        '<ul><!--[--><li data-index="0"><!--[-->a<!--]--></li>' +
        '<li data-index="1"><!--[-->b<!--]--></li>' +
        '<li data-index="2"><!--[-->c<!--]--></li><!--]--></ul>' +
        "<ol><!--[--><li><!--[-->a<!--]--></li><li><!--[-->0<!--]--></li>" +
        "<li><!--[-->b<!--]--></li><li><!--[-->1<!--]--></li>" +
        "<li><!--[-->c<!--]--></li><li><!--[-->2<!--]--></li><!--]--></ol>" +
        "<table><tbody><tr><td><!--[-->Untitled<!--]--></td></tr></tbody></table>" +
        "text <!--[-->a<!--]--> <hr>" +
        "</section><!--/l:0-->",
    );
    // Outside islands the same module renders no markers.
    expect(await renderServer(module, "Structure", { id: "s1" })).not.toContain("<!--");
  });
});

describe.skipIf(!binding)("client/server parity", () => {
  it("counter", () =>
    expectParity(COUNTER, [
      ["Counter", { start: 4 }],
      ["Counter", { start: 9 }],
    ]));
  it("keyed list", () => expectParity(TABLE, [["Table"]]));
  it("components and scope tokens", () => expectParity(CARD, [["Page"]]));
  it("nested style subtrees (decision-23)", () => expectParity(NESTED_STYLES, [["Tree"]]));
  it("class forwarding (TASK-92)", () => expectParity(CLASS_FORWARDING, [["Outer"]]));
  it("text children (TASK-65)", () =>
    expectParity(TEXT_CHILDREN, [
      ["Texts", { a: "A" }],
      ["Texts", { a: "" }],
    ]));
  it("attributes and properties", () => expectParity(ATTRIBUTES, [["Attributes", { size: 3 }]]));
  it("table rows and select values", () =>
    // A string value: happy-dom's select.value setter does not convert numbers.
    expectParity(TABLE_SELECT, [
      ["Pick", { choice: "2" }],
      ["Pick", { choice: "Three" }],
    ]));
  it("structure", () =>
    expectParity(STRUCTURE, [["Structure", { id: "s1", title: "T" }], ["Fragment"]]));
});
