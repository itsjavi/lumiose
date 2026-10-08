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
): Promise<{ module: Module; code: string }> {
  const result = binding!.compile(source, `/src/ssr${counter}.tsx`, {
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
  return { module: await import(/* @vite-ignore */ pathToFileURL(file).href), code: result.code };
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
function normalized(root: Element): string {
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
  return normalized(container);
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
    return <article class={props.class}><h2>{props.title}</h2>{props.children}</article>;
  }
  export function Page() {
    return <main><Card title={post().title} class="featured">{post().body}</Card></main>;
  }`;
const CARD_SCOPES = { scopeTokens: { components: { Page: "data-l-p1", Card: "data-l-c2" } } };

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
    const { module } = await load(CARD, "server", CARD_SCOPES);
    expect(await renderServer(module, "Page")).toBe(
      '<main data-l-p1><article data-l-c2 class="featured" data-l-p1>' +
        "<h2 data-l-c2>One</h2>First &lt;b&gt;</article></main>",
    );
  });

  it("attributes, properties and escaping", async () => {
    const { module } = await load(ATTRIBUTES, "server");
    expect(await renderServer(module, "Attributes", { size: 3 })).toBe(
      '<form title="Ada &quot;the&quot; &lt;first&gt;" data-size="3" aria-busy="true">' +
        '<input value="Ada &quot;the&quot; &lt;first&gt;" disabled>' +
        "<input type=checkbox checked>" +
        '<input value="Ada &quot;the&quot; &lt;first&gt;">' +
        '<p class="base on" style="color:red;width:3px"></p>' +
        '<p class="a b" style="margin: 0"></p>' +
        "<div><i>3</i></div>" +
        '<span>Ada "the" &lt;first&gt;</span>' +
        '<textarea>Ada "the" &lt;first&gt;</textarea>' +
        '<label>Ada "the" &lt;first&gt;</label>' +
        "<b>&lt;3&gt;</b>" +
        "</form>",
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
    expect(code).toContain("export const Member = /* @__PURE__ */ $async(async function Member");
    expect(code).toContain("(await $await(() => wait(");
    expect(await renderServer(module, "Team")).toBe(
      '<section><h3 title="boom">Ada 1 a,b</h3><h3 title="boom">Ada 2 a,b</h3></section>',
    );
  });

  it("island call sites render ranges, slots and records", async () => {
    const { module, code } = await load(ISLANDS, "server");
    expect(code).toMatch(
      /island\("\/src\/ssr\d+\.tsx#Panel", Panel, \{ ids: \[1, 2\] \}, "load", void 0, \{/,
    );
    const html = await renderServer(module, "Page");
    const [body, records] = html.split('<script type="application/json" data-l-islands>');
    expect(body).toBe(
      "<main>" +
        '<!--l:0--><template data-l-slot="footer"><i>foot</i></template>' +
        '<template data-l-slot="children"><p>child</p></template>' +
        "<div class=panel><!--[-->1+2<!--]--><!--[--><i>foot</i><!--]--><!--[--><p>child</p><!--]--></div><!--/l:0-->" +
        "<!--l:1--><b><!--[-->42<!--]--></b><!--/l:1-->" +
        "</main>",
    );
    const recorded = JSON.parse(records!.slice(0, records!.indexOf("</script>")));
    expect(recorded).toMatchObject([
      { id: 0, strategy: "load", props: { ids: [1, 2] }, slots: ["footer", "children"] },
      { id: 1, strategy: "visible", value: "100px", props: { n: 21 }, awaits: { "0:0:0": 42 } },
    ]);
    expect(recorded[0].ref).toMatch(/^\/src\/ssr\d+\.tsx#Panel$/);
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
  it("components and scope tokens", () => expectParity(CARD, [["Page"]], CARD_SCOPES));
  it("attributes and properties", () => expectParity(ATTRIBUTES, [["Attributes", { size: 3 }]]));
  it("structure", () =>
    expectParity(STRUCTURE, [["Structure", { id: "s1", title: "T" }], ["Fragment"]]));
});
