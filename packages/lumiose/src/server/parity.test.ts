// @vitest-environment happy-dom
// Client/server parity (TASK-44): the same inputs written by the client runtime (../dom) and
// rendered by the server helpers must give the same DOM. Server HTML is parsed by happy-dom and
// both sides are compared as serialized HTML (style attributes normalized to their cssText).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createComponent as clientComponent,
  render,
  setAttr,
  setClass,
  setStyle,
  setText,
  spread,
} from "../dom/index.ts";
import * as client from "../dom/public.ts";
import { BOOLEANISH } from "./attrs.ts";
import * as server from "./elements.ts";
import {
  attr,
  classAttr,
  createComponent,
  escape,
  rawText,
  renderToString,
  spreadAttrs,
  styleAttr,
  text,
} from "./index.ts";

afterEach(() => {
  document.body.textContent = "";
});

/** Rewrites each `style` attribute as the browser serializes the declarations it parsed. */
function normalize(root: Element): Element {
  for (const el of [root, ...root.querySelectorAll("[style]")]) {
    if (el.hasAttribute("style")) el.setAttribute("style", (el as HTMLElement).style.cssText);
  }
  return root;
}

/** Server HTML as the browser parses and serializes it. */
function parsed(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  return normalize(container).innerHTML;
}

function written(el: Element): string {
  return normalize(el).outerHTML;
}

const TEXT_VALUES: unknown[] = [
  "a < b & c > d",
  "",
  0,
  -0,
  1.5,
  Number.NaN,
  10n,
  true,
  false,
  null,
  undefined,
  { toString: () => "<obj>" },
];

describe("text parity", () => {
  it.each(TEXT_VALUES.map((value) => [String(value), value]))("text(%s)", (_, value) => {
    const p = document.createElement("p");
    const node = document.createTextNode("x");
    p.append(node);
    setText(node, value);
    expect(parsed(`<p>${text(value) as string}</p>`)).toBe(written(p));
    expect(parsed(`<p>${escape(value)}</p>`)).toBe(written(p));
  });
});

// Every name of the shared table plus plain booleans, enumerated attributes with other keywords
// (translate yes/no, autocapitalize…) and ordinary attributes.
const ATTRIBUTE_NAMES = [
  "aria-hidden",
  "aria-pressed",
  "aria-checked",
  "aria-expanded",
  "aria-label",
  "contenteditable",
  "draggable",
  "spellcheck",
  "writingsuggestions",
  "preserveAlpha",
  "displaystyle",
  "accent",
  "accentunder",
  "fence",
  "largeop",
  "movablelimits",
  "separator",
  "stretchy",
  "symmetric",
  "hidden",
  "disabled",
  "inert",
  "required",
  "open",
  "autofocus",
  "multiple",
  "translate",
  "autocapitalize",
  "autocorrect",
  "enterkeyhint",
  "inputmode",
  "popover",
  "dir",
  "focusable",
  "title",
  "id",
  "tabindex",
  "role",
  "data-state",
];
const ATTRIBUTE_VALUES: unknown[] = [
  true,
  false,
  null,
  undefined,
  "",
  "x",
  `a "q" & <t>`,
  0,
  1,
  -1.5,
  Number.NaN,
];

describe("attribute parity", () => {
  it("keeps the server's booleanish table identical to the client's", () => {
    const source = readFileSync(join(import.meta.dirname, "../dom/attributes.ts"), "utf8");
    expect(source, "server/attrs.ts BOOLEANISH must match dom/attributes.ts").toContain(
      `/${BOOLEANISH.source}/`,
    );
  });

  it.each(ATTRIBUTE_NAMES)("attr(%s, …)", (name) => {
    for (const value of ATTRIBUTE_VALUES) {
      const div = document.createElement("div");
      setAttr(div, name, value);
      expect(parsed(`<div${attr(name, value)}></div>`), `${name}=${String(value)}`).toBe(
        written(div),
      );
    }
  });
});

describe("custom element attributes (TASK-337)", () => {
  it("leave objects and arrays to the client, which sets them as properties", () => {
    const items = ["a", "b"];
    expect(attr("items", items, true)).toBe("");
    expect(attr("config", { a: 1 }, true)).toBe("");
    expect(attr("max", 5, true)).toBe(' max="5"');
    expect(attr("label", "x", true)).toBe(' label="x"');
    expect(attr("open", true, true)).toBe(" open");
    expect(spreadAttrs({ items, max: 5 }, true)).toBe(' max="5"');
    // Built-in elements are unchanged: an object renders its string (a URL).
    expect(attr("href", new URL("https://example.com/a"))).toBe(' href="https://example.com/a"');
    expect(spreadAttrs({ items })).toBe(' items="a,b"');
  });
});

describe("unsafe URL parity (TASK-168, decision-29)", () => {
  const UNSAFE = [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " \u0001javascript:alert(1)",
    "java\tscr\nipt:alert(1)",
    "\njavascript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "DATA: Text/HTML;base64,PHNjcmlwdD4=",
  ];
  const SAFE = [
    "/relative?q=javascript:x",
    "https://example.com/a",
    "mailto:a@example.com",
    "data:image/png;base64,AAAA",
    "&#106;avascript:alert(1)",
    "&#x6A;avascript:alert(1)",
    "#javascript:x",
  ];

  it("blocks unsafe values of URL attributes the same way on both sides", () => {
    for (const name of ["href", "src", "action", "formaction", "xlink:href", "poster", "data"]) {
      for (const value of [...UNSAFE, ...SAFE]) {
        const el = document.createElement("a");
        setAttr(el, name, value);
        const html = parsed(`<a${attr(name, value)}></a>`);
        expect(html, `${name}=${JSON.stringify(value)}`).toBe(written(el));
        const expected = UNSAFE.includes(value) ? "about:blank#blocked" : value;
        expect(el.getAttribute(name), `${name}=${JSON.stringify(value)}`).toBe(expected);
      }
    }
  });

  it("drops lowercase on* keys of spread props on both sides (TASK-165)", () => {
    const props = { onclick: "alert(1)", ONMOUSEOVER: "alert(2)", title: "kept" };
    const el = document.createElement("a");
    render(() => (spread(el, () => props), el), document.createElement("main"));
    expect(parsed(`<a${spreadAttrs(props)}></a>`)).toBe(written(el));
    expect(spreadAttrs(props)).toBe(' title="kept"');
  });

  it("blocks them in spread props too, and leaves other attributes alone", () => {
    const props = { href: "javascript:alert(1)", title: "javascript:alert(1)", src: "/ok.png" };
    const el = document.createElement("a");
    render(() => (spread(el, () => props), el), document.createElement("main"));
    expect(parsed(`<a${spreadAttrs(props)}></a>`)).toBe(written(el));
    expect(el.getAttribute("href")).toBe("about:blank#blocked");
    expect(el.getAttribute("title")).toBe("javascript:alert(1)");
  });
});

describe("class and style parity", () => {
  it.each([
    "a b",
    "  a \t  b\n",
    "a b a",
    ["a", { b: true, c: false }, ["d", null], "a"],
    { hot: true, cold: false },
    { "x y": true },
    "",
    null,
    [],
    [false, 0, undefined],
  ])("class %j", (value) => {
    const div = document.createElement("div");
    setClass(div, value);
    expect(parsed(`<div${classAttr(value)}></div>`)).toBe(written(div));
  });

  it.each([
    "color: red",
    { color: "red", "--size": 2, "margin-top": "1px", opacity: 0 },
    { color: null, margin: false, padding: "" },
    {},
    null,
  ])("style %j", (value) => {
    const div = document.createElement("div");
    setStyle(div, value);
    expect(parsed(`<div${styleAttr(value)}></div>`)).toBe(written(div));
  });
});

describe("spread parity", () => {
  it("writes the same attributes for a props object", () => {
    const props: Record<string, unknown> = {
      id: "card",
      title: `"quoted" & <b>`,
      class: ["a", { b: true, c: false }],
      style: { color: "red", "--gap": 2 },
      hidden: false,
      inert: true,
      "aria-busy": false,
      "aria-hidden": true,
      draggable: false,
      tabindex: 0,
      "data-n": 1,
      "xlink:href": "#icon",
      onClick: () => {},
      "on:custom": () => {},
      ref: () => {},
      key: "k",
      children: "ignored",
      $$scope: "data-l-p1",
    };
    const div = document.createElement("div");
    render(() => (spread(div, () => props), div), document.createElement("main"));
    expect(parsed(`<div${spreadAttrs(props)}></div>`)).toBe(written(div));
  });

  it("renders DOM properties as the attributes that give the same initial state", () => {
    const props = { type: "checkbox", value: "on", checked: true, indeterminate: true };
    const input = document.createElement("input");
    render(() => (spread(input, () => props), input), document.createElement("main"));
    const container = document.createElement("div");
    container.innerHTML = `<input${spreadAttrs(props)}>`;
    const ssr = container.firstElementChild as HTMLInputElement;
    expect(ssr.value).toBe(input.value);
    expect(ssr.checked).toBe(input.checked);
    // Property-only: no attribute form, so the client sets it after hydration.
    expect(ssr.hasAttribute("indeterminate")).toBe(false);
  });
});

/** Server output (rendered and parsed) and client output (mounted) of the same component tree. */
async function both(
  clientCode: () => unknown,
  serverCode: () => unknown,
): Promise<[string, string]> {
  const container = document.createElement("div");
  render(clientCode as () => never, container);
  return [parsed(await renderToString(serverCode)), normalize(container).innerHTML];
}

/** Server-renders `<Dynamic>` with `props`. */
function renderDynamic(props: client.DynamicProps): Promise<string> {
  return renderToString(() => createComponent(server.Dynamic, props));
}

describe("public component parity", () => {
  it("ref() reads undefined on the server and ignores writes", () => {
    const el = document.createElement("div");
    const ssrRef = server.ref<HTMLDivElement>();
    expect(ssrRef()).toBeUndefined();
    ssrRef(el);
    expect(ssrRef()).toBeUndefined();
    expect(client.ref<HTMLDivElement>()()).toBeUndefined();
  });

  it("Portal renders nothing in place on either side, and nothing at all on the server", async () => {
    let evaluated = 0;
    const props = {
      get children() {
        evaluated++;
        return "portal content";
      },
    };
    const [ssr, dom] = await both(
      () => clientComponent(client.Portal, props),
      () => createComponent(server.Portal, props),
    );
    expect(ssr).toBe("");
    expect(dom).toBe("");
    // The client renders the content into body; the server never evaluates it.
    expect(document.body.lastElementChild?.textContent).toBe("portal content");
    expect(evaluated).toBe(1);
  });

  it.each([
    [
      "a component",
      (props: { name: string }) => ["Hi ", props.name, "!"],
      { name: "<Ada>" },
      "Hi &lt;Ada&gt;!",
    ],
    [
      "an intrinsic tag",
      "section",
      { id: "s", "aria-hidden": false, class: { on: true }, children: ["a & b", 1] },
      '<section id="s" aria-hidden="false" class="on">a &amp; b1</section>',
    ],
    [
      "a void tag",
      "input",
      { type: "text", disabled: true, children: "dropped" },
      '<input type="text" disabled="">',
    ],
    ["textContent", "p", { textContent: "<raw>" }, "<p>&lt;raw&gt;</p>"],
    [
      "innerHTML",
      "div",
      { innerHTML: "<b>bold</b>", children: " tail" },
      "<div><b>bold</b> tail</div>",
    ],
    ["nothing", null, { children: "x" }, ""],
  ])("Dynamic with %s", async (_, component, props, expected) => {
    const all = { component, ...props } as client.DynamicProps;
    const [ssr, dom] = await both(
      () => clientComponent(client.Dynamic, all),
      () => createComponent(server.Dynamic, all),
    );
    expect(dom).toBe(expected);
    expect(ssr).toBe(dom);
  });

  it("Dynamic writes the text of a <style> or <script> as raw text, as the compiler does (TASK-495)", async () => {
    const css = "a::after { content: '</style><img src=x onerror=alert(1)>' }";
    const data = JSON.stringify({ html: "</script><img src=x>" });
    expect(await renderDynamic({ component: "style", children: css })).toBe(
      `<style>${rawText(css, "style")}</style>`,
    );
    // The client sets a raw text element's `innerHTML` as text.
    expect(await renderDynamic({ component: "STYLE", innerHTML: css })).toBe(
      `<STYLE>${rawText(css, "style")}</STYLE>`,
    );
    expect(await renderDynamic({ component: "script", textContent: "x = '<b>'" })).toBe(
      `<script>${rawText("x = '<b>'", "script")}</script>`,
    );
    expect(
      await renderDynamic({ component: "script", type: "application/ld+json", children: data }),
    ).toBe(`<script type="application/ld+json">${rawText(data, "script", true)}</script>`);
  });

  it("Dynamic rejects tag names that could inject markup", () => {
    expect(() => server.Dynamic({ component: 'a onclick="x"' })).toThrow(
      /is not a valid element name/,
    );
  });
});
