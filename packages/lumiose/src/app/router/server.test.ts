// SPA pages on the server (spec §7.1, §7.5): the request handler renders the SPA part of `spa`
// pages as one root island (or an empty shell with `ssr = false`), the client table and the SPA
// entry module. Server components are hand-compiled (contract doc-2 §5).
import { describe, expect, it, vi } from "vitest";
import { createComponent, insert, ssr } from "../../server/index.ts";
import { createRouteManifest, type RouteManifest } from "../routes/manifest.ts";
import { createRequestHandler, type ModuleExports } from "../server/handler.ts";
import { hasSpa, spaEntryCode } from "@lumiose/vite/internal/app/router/entry.ts";
import { formatPattern } from "../routes/segments.ts";
import { Link } from "./index.server.ts";
import { clientTable, spaErrorPart, spaHydrates, spaPagePart } from "./table.ts";

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
    const response = await fetch(new Request(new URL(path, "https://lumiose.test")));
    return { status: response.status, html: await response.text(), loaded: [...loaded] };
  };
  return { get, manifest };
}

const SPA = 'export const mode = "spa";';

describe("SPA pages in the request handler", () => {
  const files = {
    "layout.tsx": "",
    "app/layout.tsx": SPA,
    "app/page.tsx": "",
    "app/[id]/page.tsx": "",
    "app/not-found.tsx": "",
    "app/editor/page.tsx": "export const ssr = false;",
    "about/page.tsx": "",
  };
  const modules = {
    "src/routes/layout.tsx": layout("body-shell"),
    "src/routes/app/layout.tsx": layout("app-shell"),
    "src/routes/app/page.tsx": page(() => "<h1>app</h1>"),
    "src/routes/app/[id]/page.tsx": page((props) => `<h1>item ${props.params.id}</h1>`),
    "src/routes/app/not-found.tsx": page(
      (props) => `<h1>${props.status} ${props.error.message}</h1>`,
    ),
    "src/routes/app/editor/page.tsx": page(() => "<h1>editor</h1>"),
    "src/routes/about/page.tsx": page(() => "<h1>about</h1>"),
  };

  it("renders the part below the first spa layout as one root island", async () => {
    const { get } = app(files, modules);
    const { html } = await get("/app/7");
    expect(html).toContain(
      '<script type="module" async src="/spa.js"></script><link rel="modulepreload" href="/src/routes/app/[id]/page.tsx">',
    );
    expect(html).toContain(
      "<body-shell><!--l:0--><app-shell><!--[--><h1>item 7</h1><!--]--></app-shell><!--/l:0--></body-shell>",
    );
    expect(html).toContain(
      '[{"id":0,"ref":"/src/routes/app/[id]/page.tsx#lumiose:spa","strategy":"load","props":{}}]',
    );
  });

  it("sends a shell for ssr = false, without loading the SPA's modules", async () => {
    const { get } = app(files, modules);
    const { html, loaded } = await get("/app/editor");
    expect(loaded).toEqual(["src/routes/layout.tsx"]);
    expect(html).toContain("<body-shell><!--l:0--><!--/l:0--></body-shell>");
    expect(html).toContain('"ref":"/src/routes/app/editor/page.tsx#lumiose:csr","strategy":"only"');
    expect(html).toContain('<script type="module" async src="/spa.js">');
  });

  it("renders not-found pages below an spa layout inside the SPA, with their status as props", async () => {
    const { get } = app(files, modules);
    const { status, html } = await get("/app/x/y");
    expect(status).toBe(404);
    expect(html).toContain("<!--l:0--><app-shell><!--[--><h1>404 Not Found</h1>");
    expect(html).toContain(
      '"ref":"/src/routes/app/not-found.tsx#lumiose:spa","strategy":"load","props":{"status":404,"message":"Not Found"}',
    );
    // Its pages render per request, so the 404 is final (TASK-231).
    expect(html).not.toContain("data-l-reroute");
  });

  it("hides a not-found page at the URL of a page that reroutes until the router has rendered (TASK-231)", async () => {
    const { get } = app(
      {
        ...files,
        "app/layout.tsx": `${SPA}\nexport const prerender = true;`,
        "app/editor/page.tsx": "export const ssr = false;\nexport const prerender = false;",
        "app/docs/[...path]/page.tsx": "",
      },
      { ...modules, "src/routes/app/docs/[...path]/page.tsx": page(() => "<h1>docs</h1>") },
    );
    const { status, html } = await get("/app/x/y");
    expect(status).toBe(404);
    const source = /new RegExp\(("[^"]*")\)/.exec(html)?.[1];
    expect(html.indexOf("data-l-reroute")).toBeLessThan(html.indexOf("<body-shell>"));
    const pattern = new RegExp(JSON.parse(source!) as string);
    // Prerendered pages with params; `/app` and `/app/editor` have their own files.
    expect(
      ["/app/7", "/app/7/", "/app/docs", "/app/docs/a/b"].filter((p) => pattern.test(p)),
    ).toHaveLength(4);
    expect(["/app", "/app/x/y", "/about", "/other/7"].some((p) => pattern.test(p))).toBe(false);
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
      { "layout.tsx": SPA, "page.tsx": "", "b/page.tsx": "" },
      {
        "src/routes/layout.tsx": (props: Props) =>
          ssr(
            ["<nav>", "", "</nav>", ""],
            insert(createComponent(Link, { href: "/", children: "Home" })),
            insert(createComponent(Link, { href: "/b", prefetch: "none", class: "x" })),
            insert(() => props.children),
          ),
        "src/routes/page.tsx": page(() => "home"),
        "src/routes/b/page.tsx": page(() => "b"),
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
    "layout.tsx": "",
    "page.tsx": "",
    "api/items/route.ts": "",
    "app/layout.tsx": SPA,
    "app/[id]/page.tsx": "",
    "app/(admin)/layout.tsx": 'export const mode = "server";',
    "app/(admin)/settings/page.tsx": SPA,
    "app/not-found.tsx": "",
    "error.tsx": "",
    "solo/page.tsx": SPA,
  });

  it("finds each page's SPA part", () => {
    expect(
      spaPagePart(manifest, ["src/routes/layout.tsx"], "src/routes/solo/page.tsx", true),
    ).toEqual({
      outer: ["src/routes/layout.tsx"],
      levels: ["src/routes/solo/page.tsx"],
      app: "src/routes/solo/page.tsx",
      ssr: true,
    });
    expect(
      spaErrorPart(
        manifest,
        ["src/routes/layout.tsx", "src/routes/app/layout.tsx"],
        "src/routes/app/not-found.tsx",
      ),
    ).toEqual({
      outer: ["src/routes/layout.tsx"],
      levels: ["src/routes/app/layout.tsx", "src/routes/app/not-found.tsx"],
      app: "src/routes/app/layout.tsx",
      ssr: true,
    });
    expect(spaErrorPart(manifest, ["src/routes/layout.tsx"], "src/routes/error.tsx")).toBe(
      undefined,
    );
  });

  it("lists every route, with the levels of SPA pages and the SPA's error pages", () => {
    const table = clientTable(manifest)!;
    expect(table.routes.map((route) => [route.app, route.levels])).toEqual([
      [undefined, undefined],
      ["src/routes/solo/page.tsx", ["src/routes/solo/page.tsx"]],
      [undefined, undefined],
      [
        "src/routes/app/layout.tsx",
        [
          "src/routes/app/layout.tsx",
          "src/routes/app/(admin)/layout.tsx",
          "src/routes/app/(admin)/settings/page.tsx",
        ],
      ],
      ["src/routes/app/layout.tsx", ["src/routes/app/layout.tsx", "src/routes/app/[id]/page.tsx"]],
    ]);
    expect(table.routes[4]).toMatchObject({
      notFound: "src/routes/app/not-found.tsx",
      error: "src/routes/error.tsx",
    });
    expect(table.pages).toEqual({
      "src/routes/app/not-found.tsx": {
        app: "src/routes/app/layout.tsx",
        levels: ["src/routes/app/layout.tsx", "src/routes/app/not-found.tsx"],
      },
    });
  });

  it("marks the pages whose 404s the router resolves: params, not rendered per request (TASK-231)", () => {
    const table = clientTable(
      manifestOf(
        {
          "layout.tsx": "export const prerender = true;",
          "page.tsx": "",
          "songs/[id]/page.tsx": "",
          "drafts/[id]/page.tsx": "export const prerender = false;\nexport const ssr = false;",
          "live/[id]/page.tsx": "export const prerender = false;",
          "not-found.tsx": "",
        },
        "spa",
      ),
    )!;
    expect(
      table.routes.map((route) => [formatPattern(route.segments), route.reroute ?? false]),
    ).toEqual([
      ["/", false],
      ["/drafts/[id]", true],
      ["/live/[id]", false],
      ["/songs/[id]", true],
    ]);
  });

  it("generates the SPA entry module", () => {
    expect(hasSpa(manifest)).toBe(true);
    const code = spaEntryCode(manifest, "/base/");
    expect(code).toContain('import islands from "virtual:lumiose/islands";');
    expect(code).toContain('base: "/base/"');
    expect(code).toContain(
      '"src/routes/app/[id]/page.tsx": () => import("/src/routes/app/[id]/page.tsx"),',
    );
    expect(code).not.toContain('import("/src/routes/page.tsx")');
    expect(spaEntryCode(manifestOf({ "page.tsx": "" }), "/")).toBe("export {};\n");
    // A build where nothing hydrates starts the SPA without the island loader (TASK-91).
    const csr = spaEntryCode(manifest, "/", { csr: true });
    expect(csr).toMatch(/^import \{ startCsr \} from ".*\/router\/csr\.ts";/);
    expect(csr).not.toContain("virtual:lumiose/islands");
    expect(csr).toContain(
      '"src/routes/app/[id]/page.tsx": () => import("/src/routes/app/[id]/page.tsx"),',
    );
  });

  it("tells whether any SPA page renders on the server", () => {
    expect(spaHydrates(manifest)).toBe(true);
    const shells = {
      "layout.tsx": "export const ssr = false;",
      "page.tsx": "",
      "not-found.tsx": "",
    };
    expect(spaHydrates(manifestOf(shells, "spa"))).toBe(false);
    expect(
      spaHydrates(manifestOf({ ...shells, "about/page.tsx": "export const ssr = true;" }, "spa")),
    ).toBe(true);
    expect(spaHydrates(manifestOf({ "page.tsx": "" }))).toBe(false);
  });

  it("makes the whole app one SPA with lumiose({ mode: 'spa' })", () => {
    const spa = manifestOf({ "layout.tsx": "", "page.tsx": "", "not-found.tsx": "" }, "spa");
    const table = clientTable(spa)!;
    expect(table.routes[0]).toMatchObject({
      app: "src/routes/layout.tsx",
      levels: ["src/routes/layout.tsx", "src/routes/page.tsx"],
    });
    expect(Object.keys(table.pages)).toEqual(["src/routes/not-found.tsx"]);
  });
});
