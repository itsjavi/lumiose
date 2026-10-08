// SPA pages on the server (spec §7.1, §7.5): the request handler renders the SPA part of `spa`
// pages as one root island (or an empty shell with `ssr = false`), the client table and the SPA
// entry module. Server components are hand-compiled (contract doc-2 §5).
import { describe, expect, it, vi } from "vitest";
import { createComponent, insert, ssr } from "../../server/index.ts";
import { createRouteManifest, type RouteManifest } from "../routes/manifest.ts";
import { createRequestHandler, type ModuleExports } from "../server/handler.ts";
import { hasSpa, spaEntryCode } from "./entry.ts";
import { Link } from "./index.server.ts";
import { clientTable, spaErrorPart, spaPagePart } from "./table.ts";

type Props = any;

/** `{ path: source }` route files → manifest; sources only declare `mode`/`ssr`. */
function manifestOf(files: Record<string, string>, defaultMode?: "spa"): RouteManifest {
  const manifest = createRouteManifest(
    Object.entries(files).map(([path, source]) => ({ path, source })),
    defaultMode === undefined ? {} : { defaultMode },
  );
  expect(manifest.diagnostics).toEqual([]);
  return manifest;
}

const layout = (tag: string) => (props: Props) =>
  ssr(
    [`<${tag}>`, `</${tag}>`],
    insert(() => props.children),
  );
const page = (html: (props: Props) => string) => (props: Props) => ssr([html(props)]);

function app(files: Record<string, string>, modules: Record<string, (props: Props) => unknown>) {
  const manifest = manifestOf(files);
  const loaded: string[] = [];
  const { fetch } = createRequestHandler({
    manifest,
    loadModule: async (file) => {
      loaded.push(file);
      const component = modules[file];
      if (component === undefined) throw new Error(`no module ${file}`);
      return { default: component } as ModuleExports;
    },
    spaEntry: "/spa.js",
    onError: vi.fn(),
  });
  const get = async (path: string) => {
    loaded.length = 0;
    const response = await fetch(new Request(new URL(path, "https://lumen.test")));
    return { status: response.status, html: await response.text(), loaded: [...loaded] };
  };
  return { get, manifest };
}

const SPA = 'export const mode = "spa";';

describe("SPA pages in the request handler", () => {
  const files = {
    "_layout.tsx": "",
    "app/_layout.tsx": SPA,
    "app/index.tsx": "",
    "app/[id].tsx": "",
    "app/_404.tsx": "",
    "app/editor.tsx": "export const ssr = false;",
    "about.tsx": "",
  };
  const modules = {
    "src/routes/_layout.tsx": layout("body-shell"),
    "src/routes/app/_layout.tsx": layout("app-shell"),
    "src/routes/app/index.tsx": page(() => "<h1>app</h1>"),
    "src/routes/app/[id].tsx": page((props) => `<h1>item ${props.params.id}</h1>`),
    "src/routes/app/_404.tsx": page((props) => `<h1>${props.status} ${props.error.message}</h1>`),
    "src/routes/app/editor.tsx": page(() => "<h1>editor</h1>"),
    "src/routes/about.tsx": page(() => "<h1>about</h1>"),
  };

  it("renders the part below the first spa layout as one root island", async () => {
    const { get } = app(files, modules);
    const { html } = await get("/app/7");
    expect(html).toContain(
      '<script type="module" async src="/spa.js"></script><link rel="modulepreload" href="/src/routes/app/[id].tsx">',
    );
    expect(html).toContain(
      "<body-shell><!--l:0--><app-shell><!--[--><h1>item 7</h1><!--]--></app-shell><!--/l:0--></body-shell>",
    );
    expect(html).toContain(
      '[{"id":0,"ref":"/src/routes/app/[id].tsx#lumen:spa","strategy":"load","props":{}}]',
    );
  });

  it("sends a shell for ssr = false, without loading the SPA's modules", async () => {
    const { get } = app(files, modules);
    const { html, loaded } = await get("/app/editor");
    expect(loaded).toEqual(["src/routes/_layout.tsx"]);
    expect(html).toContain("<body-shell><!--l:0--><!--/l:0--></body-shell>");
    expect(html).toContain('"ref":"/src/routes/app/editor.tsx#lumen:csr","strategy":"only"');
    expect(html).toContain('<script type="module" async src="/spa.js">');
  });

  it("renders _404 pages below an spa layout inside the SPA, with their status as props", async () => {
    const { get } = app(files, modules);
    const { status, html } = await get("/app/x/y");
    expect(status).toBe(404);
    expect(html).toContain("<!--l:0--><app-shell><!--[--><h1>404 Not Found</h1>");
    expect(html).toContain(
      '"ref":"/src/routes/app/_404.tsx#lumen:spa","strategy":"load","props":{"status":404,"message":"Not Found"}',
    );
  });

  it("leaves other pages alone", async () => {
    const { get } = app(files, modules);
    const { html } = await get("/about");
    expect(html).toContain("<body-shell><h1>about</h1></body-shell>");
    expect(html).not.toContain("l:0");
  });
});

describe("server <Link>", () => {
  it("renders an <a>, marks the current page and the prefetch level", async () => {
    const { get } = app(
      { "_layout.tsx": SPA, "index.tsx": "", "b.tsx": "" },
      {
        "src/routes/_layout.tsx": (props: Props) =>
          ssr(
            ["<nav>", "", "</nav>", ""],
            insert(createComponent(Link, { href: "/", children: "Home" })),
            insert(createComponent(Link, { href: "/b", prefetch: "none", class: "x" })),
            insert(() => props.children),
          ),
        "src/routes/index.tsx": page(() => "home"),
        "src/routes/b.tsx": page(() => "b"),
      },
    );
    const { html } = await get("/");
    expect(html).toContain(
      '<nav><!--[--><a href="/" aria-current="page"><!--[-->Home<!--]--></a><!--]--><!--[--><a href="/b" class="x" data-l-prefetch="none"><!--[--><!--]--></a><!--]--></nav>',
    );
  });
});

describe("the client table", () => {
  const manifest = manifestOf({
    "_layout.tsx": "",
    "index.tsx": "",
    "api/items.ts": "",
    "app/_layout.tsx": SPA,
    "app/[id].tsx": "",
    "app/(admin)/_layout.tsx": 'export const mode = "server";',
    "app/(admin)/settings.tsx": SPA,
    "app/_404.tsx": "",
    "_error.tsx": "",
    "solo.tsx": SPA,
  });

  it("finds each page's SPA part", () => {
    expect(spaPagePart(manifest, ["src/routes/_layout.tsx"], "src/routes/solo.tsx", true)).toEqual({
      outer: ["src/routes/_layout.tsx"],
      levels: ["src/routes/solo.tsx"],
      app: "src/routes/solo.tsx",
      ssr: true,
    });
    expect(
      spaErrorPart(
        manifest,
        ["src/routes/_layout.tsx", "src/routes/app/_layout.tsx"],
        "src/routes/app/_404.tsx",
      ),
    ).toEqual({
      outer: ["src/routes/_layout.tsx"],
      levels: ["src/routes/app/_layout.tsx", "src/routes/app/_404.tsx"],
      app: "src/routes/app/_layout.tsx",
      ssr: true,
    });
    expect(spaErrorPart(manifest, ["src/routes/_layout.tsx"], "src/routes/_error.tsx")).toBe(
      undefined,
    );
  });

  it("lists every route, with the levels of SPA pages and the SPA's error pages", () => {
    const table = clientTable(manifest)!;
    expect(table.routes.map((route) => [route.app, route.levels])).toEqual([
      [undefined, undefined],
      ["src/routes/solo.tsx", ["src/routes/solo.tsx"]],
      [undefined, undefined],
      [
        "src/routes/app/_layout.tsx",
        [
          "src/routes/app/_layout.tsx",
          "src/routes/app/(admin)/_layout.tsx",
          "src/routes/app/(admin)/settings.tsx",
        ],
      ],
      ["src/routes/app/_layout.tsx", ["src/routes/app/_layout.tsx", "src/routes/app/[id].tsx"]],
    ]);
    expect(table.routes[4]).toMatchObject({
      notFound: "src/routes/app/_404.tsx",
      error: "src/routes/_error.tsx",
    });
    expect(table.pages).toEqual({
      "src/routes/app/_404.tsx": {
        app: "src/routes/app/_layout.tsx",
        levels: ["src/routes/app/_layout.tsx", "src/routes/app/_404.tsx"],
      },
    });
  });

  it("generates the SPA entry module", () => {
    expect(hasSpa(manifest)).toBe(true);
    const code = spaEntryCode(manifest, "/base/");
    expect(code).toContain('import islands from "virtual:lumen/islands";');
    expect(code).toContain('base: "/base/"');
    expect(code).toContain('"src/routes/app/[id].tsx": () => import("/src/routes/app/[id].tsx"),');
    expect(code).not.toContain('import("/src/routes/index.tsx")');
    expect(spaEntryCode(manifestOf({ "index.tsx": "" }), "/")).toBe("export {};\n");
  });

  it("makes the whole app one SPA with lumen({ mode: 'spa' })", () => {
    const spa = manifestOf({ "_layout.tsx": "", "index.tsx": "", "_404.tsx": "" }, "spa");
    const table = clientTable(spa)!;
    expect(table.routes[0]).toMatchObject({
      app: "src/routes/_layout.tsx",
      levels: ["src/routes/_layout.tsx", "src/routes/index.tsx"],
    });
    expect(Object.keys(table.pages)).toEqual(["src/routes/_404.tsx"]);
  });
});
