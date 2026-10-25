// @vitest-environment happy-dom
// `.svg` components (./svg.ts, `compileSvg`) rendered by the real runtimes: the client render and
// its accessibility attributes, the server render (identical markup), and an island that uses an
// icon, hydrated without a mismatch.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile, compileSvg } from "@lumiose/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, signal } from "lumiose/internal/core/index.ts";
import { createComponent, render } from "lumiose/internal/dom/index.ts";
import { loadIslands } from "lumiose/internal/dom/islands.ts";
import { island, renderToString } from "lumiose/internal/server/index.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "../../lumiose/src");
const IMPORTS = {
  client: { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
// Compiled modules go to packages/vite/test/out (ignored), inside the Vite root.
const out = resolve(import.meta.dirname, "../test/out/svg");
mkdirSync(out, { recursive: true });

const HOME = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
  fill="none" stroke="currentColor"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><circle cx="12" cy="15" r="2"/></svg>`;

type Module = Record<string, any>;
type Target = "client" | "server";
let counter = 0;

function write(code: string, target: Target, name: string): string {
  for (const [specifier, file] of Object.entries(IMPORTS[target])) {
    code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
  }
  const path = join(out, `${name}-${counter++}-${Date.now()}.${target}.js`);
  writeFileSync(path, code);
  return path;
}

/** The icon module and a module of components that use it, for `target`. */
async function load(target: Target, components: string): Promise<Module> {
  const icon = write(compileSvg(HOME, "/src/home.svg", { target }).code, target, "home");
  const result = compile(
    // `/` separators: a Windows path in a JS string would read its `\` as escapes.
    components.replace("./home.svg", icon.replaceAll("\\", "/")),
    // `.stsx` for components with style blocks.
    `/src/case.${components.includes("<style>") ? "stsx" : "tsx"}`,
    { target, styleImport: false, sourceMap: false },
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return (await import(/* @vite-ignore */ write(result.code, target, "case"))) as Module;
}

const COMPONENTS = `import Home from "./home.svg";
export function Icons(props) {
  return (
    <p>
      <Home title={props.title} class="icon" />
      <Home aria-label="Home" width={16} height={16} />
      <Home />
    </p>
  );
}
export function Toggle() {
  const open = window.toggleSignal;
  return (
    <button onClick={() => open.set(!open())}>
      {open() ? <Home title="Open" /> : null}
      <Home class="always" />
    </button>
  );
}
`;

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  document.body.innerHTML = "";
});
afterEach(() => warn.mockRestore());

/** Inner HTML without the client's placeholder comments. */
function markup(root: Element): string {
  return root.innerHTML.replaceAll("<!---->", "");
}

function svgs(): SVGSVGElement[] {
  return [...document.querySelectorAll("svg")] as SVGSVGElement[];
}

describe(".svg components", () => {
  it("render inline on the client with labels or aria-hidden", async () => {
    const { Icons } = await load("client", COMPONENTS);
    const title = signal("Go home");
    render(
      () =>
        createComponent(Icons, {
          get title() {
            return title();
          },
        }),
      document.body,
    );
    const [labelled, named, decorative] = svgs();
    expect(labelled!.getAttribute("role")).toBe("img");
    expect(labelled!.getAttribute("class")).toBe("icon");
    const id = labelled!.getAttribute("aria-labelledby")!;
    expect(id).toMatch(/^l\w+-t-Go_home$/);
    expect(labelled!.firstElementChild!.outerHTML).toBe(`<title id="${id}">Go home</title>`);
    expect(labelled!.hasAttribute("aria-hidden")).toBe(false);
    expect(named!.getAttribute("aria-label")).toBe("Home");
    expect(named!.getAttribute("width")).toBe("16");
    expect(named!.hasAttribute("aria-hidden")).toBe(false);
    expect(decorative!.getAttribute("aria-hidden")).toBe("true");
    expect(decorative!.getAttribute("stroke")).toBe("currentColor");
    expect(decorative!.querySelectorAll("path, circle")).toHaveLength(2);
    expect(decorative!.namespaceURI).toBe("http://www.w3.org/2000/svg");
    // `title` is reactive; clearing it makes the icon decorative.
    title.set("");
    flush();
    expect(labelled!.querySelector("title")).toBeNull();
    expect(labelled!.getAttribute("aria-hidden")).toBe("true");
    expect(labelled!.hasAttribute("role")).toBe(false);
  });

  it("render the same markup on the server", async () => {
    const client = await load("client", COMPONENTS);
    const server = await load("server", COMPONENTS);
    const html = await renderToString(() => server.Icons({ title: "Go home" }));
    render(() => createComponent(client.Icons, { title: "Go home" }), document.body);
    // Compared as parsed DOM: the server leaves simple values unquoted, the client has
    // placeholder comments.
    const parsed = document.createElement("div");
    parsed.innerHTML = html;
    expect(markup(parsed)).toBe(markup(document.body));
    expect(parsed.querySelectorAll("svg")).toHaveLength(3);
  });

  it("receive the caller's scope with a class (class passthrough)", async () => {
    const { Nav } = await load(
      "client",
      `import Home from "./home.svg";
export function Nav() {
  return <a class="link"><Home class="icon" /> Home<style>.icon { width: 1em }</style></a>;
}
`,
    );
    render(() => createComponent(Nav, {}), document.body);
    const link = document.querySelector("a")!;
    const scope = [...link.attributes].find((a) => a.name.startsWith("data-lum-"))!.name;
    expect(svgs()[0]!.hasAttribute(scope)).toBe(true);
    expect(svgs()[0]!.getAttribute("class")).toBe("icon");
  });

  it("hydrate inside an island without a mismatch", async () => {
    const toggle = signal(false);
    (globalThis as Record<string, unknown>).toggleSignal = toggle;
    const client = await load("client", COMPONENTS);
    const server = await load("server", COMPONENTS);
    document.body.innerHTML = await renderToString(() =>
      island("/src/case#Toggle", server.Toggle, {}, "load"),
    );
    const before = svgs()[0];
    loadIslands({ "/src/case#Toggle": () => Promise.resolve(client.Toggle) });
    for (let i = 0; i < 10; i++) await new Promise((done) => setTimeout(done, 0));
    flush();
    // The server's <svg> is adopted, not re-created.
    expect(svgs()[0]).toBe(before);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("LUM4006");
    document.querySelector("button")!.click();
    flush();
    const [opened, always] = svgs();
    expect(opened!.querySelector("title")!.textContent).toBe("Open");
    expect(always).toBe(before);
  });
});
