import { describe, expect, it } from "vitest";
import { createRouteManifest, type PageRoute, type RouteManifest } from "./manifest.ts";

const PAGE = "export default function Page() { return null; }";

const manifestOf = (tree: Record<string, string>, routesDir?: string): RouteManifest =>
  createRouteManifest(
    Object.entries(tree).map(([path, source]) => ({ path, source })),
    routesDir === undefined ? {} : { routesDir },
  );

const page = (manifest: RouteManifest, pattern: string): PageRoute => {
  const route = manifest.routes.find((entry) => entry.pattern === pattern);
  if (route?.kind !== "page") throw new Error(`no page ${pattern}`);
  return route;
};

describe("createRouteManifest", () => {
  it("builds pages and endpoints with patterns, params and project-relative files", () => {
    const manifest = manifestOf({
      "page.stsx": PAGE,
      "blog/[slug]/page.stsx": PAGE,
      "docs/[...path]/page.tsx": PAGE,
      "[[lang]]/files/[[...path]]/page.stsx": PAGE,
      "api/posts/route.ts": "export const GET = () => new Response();",
      "blog/[slug]/Card.stsx": "export default function Card() { return null; }",
      "blog/_lib/posts.ts": "export const posts = [];",
    });
    expect(manifest.diagnostics).toEqual([]);
    expect(
      manifest.routes.map(({ kind, pattern, params, file }) => ({ kind, pattern, params, file })),
    ).toEqual([
      { kind: "page", pattern: "/", params: [], file: "src/routes/page.stsx" },
      // Ranked by its most specific URL, /files.
      {
        kind: "page",
        pattern: "/[[lang]]/files/[[...path]]",
        params: [
          { name: "lang", rest: false, optional: true },
          { name: "path", rest: true, optional: true },
        ],
        file: "src/routes/[[lang]]/files/[[...path]]/page.stsx",
      },
      {
        kind: "endpoint",
        pattern: "/api/posts",
        params: [],
        file: "src/routes/api/posts/route.ts",
      },
      {
        kind: "page",
        pattern: "/blog/[slug]",
        params: [{ name: "slug", rest: false, optional: false }],
        file: "src/routes/blog/[slug]/page.stsx",
      },
      {
        kind: "page",
        pattern: "/docs/[...path]",
        params: [{ name: "path", rest: true, optional: false }],
        file: "src/routes/docs/[...path]/page.tsx",
      },
    ]);
  });

  it("resolves modes: own export, else the nearest layout, else static", () => {
    const manifest = manifestOf({
      "layout.stsx": PAGE,
      "page.stsx": PAGE,
      "blog/layout.stsx": `export const mode = "server";`,
      "blog/page.stsx": PAGE,
      "blog/[slug]/page.stsx": `export const mode = "static";`,
      "blog/drafts/page.stsx": PAGE,
      "blog/(admin)/layout.stsx": PAGE,
      "blog/(admin)/edit/page.stsx": PAGE,
    });
    expect(manifest.diagnostics).toEqual([]);
    expect(Object.fromEntries(manifest.routes.map((route) => [route.pattern, route.mode]))).toEqual(
      {
        "/": "static",
        "/blog": "server",
        "/blog/drafts": "server",
        "/blog/edit": "server",
        "/blog/[slug]": "static",
      },
    );
    expect(manifest.layouts.map(({ dir, pattern, mode }) => ({ dir, pattern, mode }))).toEqual([
      { dir: "", pattern: "/", mode: "static" },
      { dir: "blog", pattern: "/blog", mode: "server" },
      { dir: "blog/(admin)", pattern: "/blog", mode: "server" },
    ]);
  });

  it("collects the layout chain outermost first, including group layouts", () => {
    const manifest = manifestOf({
      "layout.stsx": PAGE,
      "(shop)/layout.stsx": PAGE,
      "(shop)/cart/layout.tsx": PAGE,
      "(shop)/cart/page.stsx": PAGE,
      "about/page.stsx": PAGE,
    });
    expect(page(manifest, "/cart").layouts).toEqual([
      "src/routes/layout.stsx",
      "src/routes/(shop)/layout.stsx",
      "src/routes/(shop)/cart/layout.tsx",
    ]);
    expect(page(manifest, "/about").layouts).toEqual(["src/routes/layout.stsx"]);
  });

  it("resolves ssr for spa routes only and warns about ssr = false elsewhere", () => {
    const manifest = manifestOf({
      "app/layout.stsx": `export const mode = "spa";\nexport const ssr = false;`,
      "app/page.stsx": PAGE,
      "app/settings/page.stsx": "export const ssr = true;",
      "app/report/page.stsx": `export const mode = "server";`,
      "about/page.stsx": "export const ssr = false;",
    });
    expect(page(manifest, "/app")).toMatchObject({ mode: "spa", ssr: false });
    expect(page(manifest, "/app/settings")).toMatchObject({ mode: "spa", ssr: true });
    expect(page(manifest, "/app/report")).toMatchObject({ mode: "server", ssr: true });
    expect(page(manifest, "/about")).toMatchObject({ mode: "static", ssr: true });
    expect(manifest.diagnostics).toMatchObject([
      { code: "LUM5002", severity: "warning", file: "src/routes/about/page.stsx" },
    ]);
  });

  it("resolves prerender for spa pages that render on the server (decision-38)", () => {
    const manifest = createRouteManifest(
      Object.entries({
        "page.stsx": PAGE,
        "live/page.stsx": "export const prerender = false;",
        "tracks/[id]/page.stsx": "export const prerender = true;",
        "shell/page.stsx": "export const ssr = false;",
        "about/page.stsx": `export const mode = "static";`,
      }).map(([path, source]) => ({ path, source })),
      { defaultMode: "spa", defaultPrerender: true },
    );
    expect(manifest.diagnostics).toEqual([]);
    expect(
      Object.fromEntries(
        manifest.routes.map((route) => [route.pattern, route.kind === "page" && route.prerender]),
      ),
    ).toEqual({
      "/": true,
      "/live": false,
      "/tracks/[id]": true,
      // An ssr = false shell stays one under the project default.
      "/shell": false,
      // Static routes are prerendered by their mode.
      "/about": false,
    });
    expect(page(manifestOf({ "page.stsx": PAGE }), "/").prerender).toBe(false);
  });

  it("reports prerender with ssr = false (LUM5006) and where prerender has no effect (LUM5002)", () => {
    const manifest = manifestOf({
      "app/layout.stsx": `export const mode = "spa";\nexport const ssr = false;`,
      "app/page.stsx": "export const prerender = true;",
      "docs/layout.stsx": "export const prerender = true;",
      "docs/page.stsx": PAGE,
      "about/page.stsx": "export const prerender = true;",
      "feed.xml/route.ts": "export const prerender = true;",
    });
    expect(page(manifest, "/app")).toMatchObject({ mode: "spa", ssr: false, prerender: false });
    expect(page(manifest, "/about")).toMatchObject({ mode: "static", prerender: false });
    expect(page(manifest, "/docs")).toMatchObject({ mode: "static", prerender: false });
    expect(manifest.diagnostics).toMatchObject([
      { code: "LUM5002", severity: "warning", file: "src/routes/feed.xml/route.ts" },
      { code: "LUM5002", severity: "warning", file: "src/routes/docs/layout.stsx" },
      { code: "LUM5002", severity: "warning", file: "src/routes/about/page.stsx" },
      { code: "LUM5006", severity: "error", file: "src/routes/app/page.stsx" },
    ]);
  });

  it("inherits prerender from the nearest layout that sets it, which a page turns off (TASK-229)", () => {
    const manifest = manifestOf({
      "layout.stsx": `export const mode = "spa";\nexport const prerender = true;`,
      "page.stsx": PAGE,
      "live/page.stsx": "export const prerender = false;",
      "tracks/[id]/page.stsx": PAGE,
      "studio/layout.stsx": "export const prerender = false;",
      "studio/page.stsx": PAGE,
      "studio/demo/layout.stsx": "export const prerender = true;",
      "studio/demo/page.stsx": PAGE,
      "report/page.stsx": `export const mode = "server";`,
    });
    expect(manifest.diagnostics).toEqual([]);
    expect(
      Object.fromEntries(
        manifest.routes.map((route) => [route.pattern, route.kind === "page" && route.prerender]),
      ),
    ).toEqual({
      "/": true,
      "/live": false,
      "/report": false,
      "/studio": false,
      "/studio/demo": true,
      "/tracks/[id]": true,
    });
  });

  it("prefers a layout's prerender over the project default (TASK-229)", () => {
    const manifest = createRouteManifest(
      Object.entries({
        "page.stsx": PAGE,
        "editor/layout.stsx": "export const prerender = false;",
        "editor/page.stsx": PAGE,
      }).map(([path, source]) => ({ path, source })),
      { defaultMode: "spa", defaultPrerender: true },
    );
    expect(page(manifest, "/").prerender).toBe(true);
    expect(page(manifest, "/editor").prerender).toBe(false);
  });

  it("reports an inherited prerender that meets ssr = false (LUM5006) once per file (TASK-229)", () => {
    const manifest = manifestOf({
      "layout.stsx": `export const mode = "spa";\nexport const prerender = true;`,
      "shell/page.stsx": "export const ssr = false;",
      "opted-out/page.stsx": "export const ssr = false;\nexport const prerender = false;",
      "editor/layout.stsx": "export const ssr = false;",
      "editor/page.stsx": PAGE,
      "editor/[id]/page.stsx": PAGE,
      "kiosk/layout.stsx": "export const ssr = false;\nexport const prerender = true;",
      "kiosk/page.stsx": PAGE,
    });
    for (const pattern of ["/shell", "/opted-out", "/editor", "/editor/[id]", "/kiosk"]) {
      expect(page(manifest, pattern)).toMatchObject({ ssr: false, prerender: false });
    }
    expect(manifest.diagnostics).toMatchObject([
      { code: "LUM5006", severity: "error", file: "src/routes/editor/layout.stsx" },
      { code: "LUM5006", severity: "error", file: "src/routes/kiosk/layout.stsx" },
      { code: "LUM5006", severity: "error", file: "src/routes/shell/page.stsx" },
    ]);
    expect(manifest.diagnostics[0]!.message).toBe(
      '"src/routes/editor/[id]/page.stsx" inherits "export const prerender = true" from "src/routes/layout.stsx", but its ssr is false, so it renders only in the browser.',
    );
  });

  it("gives endpoints a static or server mode, serving spa subtrees live", () => {
    const manifest = manifestOf({
      "sitemap.xml/route.ts": "",
      "api/layout.stsx": `export const mode = "server";`,
      "api/posts/route.ts": "",
      "api/feed/route.ts": `export const mode = "static";`,
      "app/layout.stsx": `export const mode = "spa";`,
      "app/todos/route.ts": "",
    });
    expect(Object.fromEntries(manifest.routes.map((route) => [route.pattern, route.mode]))).toEqual(
      {
        "/sitemap.xml": "static",
        "/api/posts": "server",
        "/api/feed": "static",
        "/app/todos": "server",
      },
    );
  });

  it("starts from the project default mode and ssr (decision-21), which files override", () => {
    const manifest = createRouteManifest(
      Object.entries({
        "page.stsx": PAGE,
        "about/page.stsx": `export const mode = "static";`,
        "admin/layout.stsx": `export const mode = "server";`,
        "admin/users/page.stsx": PAGE,
        "editor/page.stsx": `export const ssr = true;`,
        "api/todos/route.ts": "",
      }).map(([path, source]) => ({ path, source })),
      { defaultMode: "spa", defaultSsr: false },
    );
    expect(manifest.diagnostics).toEqual([]);
    expect(
      Object.fromEntries(
        manifest.routes.map((route) => [
          route.pattern,
          route.kind === "page" ? [route.mode, route.ssr] : [route.mode],
        ]),
      ),
    ).toEqual({
      "/": ["spa", false],
      "/about": ["static", true],
      "/admin/users": ["server", true],
      "/editor": ["spa", true],
      "/api/todos": ["server"],
    });
  });

  it("links each page to its nearest error and not-found pages", () => {
    const manifest = manifestOf({
      "not-found.stsx": PAGE,
      "error.stsx": PAGE,
      "blog/not-found.stsx": PAGE,
      "blog/[slug]/page.stsx": PAGE,
      "about/page.stsx": PAGE,
    });
    expect(page(manifest, "/blog/[slug]")).toMatchObject({
      notFoundPage: "src/routes/blog/not-found.stsx",
      errorPage: "src/routes/error.stsx",
    });
    expect(page(manifest, "/about")).toMatchObject({
      notFoundPage: "src/routes/not-found.stsx",
      errorPage: "src/routes/error.stsx",
    });
    expect(manifest.notFoundPages.map(({ file, pattern }) => ({ file, pattern }))).toEqual([
      { file: "src/routes/not-found.stsx", pattern: "/" },
      { file: "src/routes/blog/not-found.stsx", pattern: "/blog" },
    ]);
    expect(manifest.errorPages.map((entry) => entry.file)).toEqual(["src/routes/error.stsx"]);
  });

  it("reports LUM5002 for invalid route files and drops them", () => {
    const manifest = manifestOf({
      "page.stsx": PAGE,
      "loading.stsx": PAGE,
      "@modal/page.stsx": PAGE,
      "blog/[slug/page.stsx": PAGE,
      "docs/[...path]/edit/page.stsx": PAGE,
      "api/route.tsx": PAGE,
    });
    expect(manifest.routes.map((route) => route.pattern)).toEqual(["/"]);
    expect(
      manifest.diagnostics.map(({ code, severity, file }) => ({ code, severity, file })),
    ).toEqual([
      { code: "LUM5002", severity: "error", file: "src/routes/@modal/page.stsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/api/route.tsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/blog/[slug/page.stsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/docs/[...path]/edit/page.stsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/loading.stsx" },
    ]);
    expect(manifest.diagnostics.at(-1)?.help).toContain("<Suspense");
  });

  it("ignores colocated modules and private folders", () => {
    const manifest = manifestOf({
      "page.stsx": PAGE,
      "Header.stsx": PAGE,
      "about.stsx": PAGE,
      "helpers.ts": "export const x = 1;",
      "_components/page.stsx": PAGE,
      "blog/_drafts/[slug]/page.stsx": PAGE,
      "blog/_lib/route.ts": "",
    });
    expect(manifest.diagnostics).toEqual([]);
    expect(manifest.routes.map((route) => route.file)).toEqual(["src/routes/page.stsx"]);
  });

  it("reports LUM5002 for invalid or unreadable mode exports and falls back to inheritance", () => {
    const manifest = manifestOf({
      "layout.stsx": `export const mode = "server";`,
      "a/page.stsx": `export const mode = "dynamic";`,
      "b/page.stsx": "export const mode = MODE;",
      "c/route.ts": `export const mode = "spa";`,
    });
    expect(manifest.routes.map((route) => [route.pattern, route.mode])).toEqual([
      ["/a", "server"],
      ["/b", "server"],
      ["/c", "server"],
    ]);
    expect(
      manifest.diagnostics.map(({ code, file, message }) => ({ code, file, message })),
    ).toEqual([
      {
        code: "LUM5002",
        file: "src/routes/a/page.stsx",
        message: `Invalid mode "dynamic" for a page.`,
      },
      {
        code: "LUM5002",
        file: "src/routes/b/page.stsx",
        message: `"export const mode" must be a string literal, for example "server".`,
      },
      {
        code: "LUM5002",
        file: "src/routes/c/route.ts",
        message: `Invalid mode "spa" for an endpoint.`,
      },
    ]);
  });

  it("reports LUM5003 when two files serve the same URLs and keeps the first", () => {
    const manifest = manifestOf({
      "about/page.stsx": PAGE,
      "about/page.tsx": PAGE,
      "(marketing)/pricing/page.stsx": PAGE,
      "pricing/page.tsx": PAGE,
      "blog/[id]/page.stsx": PAGE,
      "blog/[slug]/page.stsx": PAGE,
      "feed/page.stsx": PAGE,
      "feed/route.ts": "",
      "layout.stsx": PAGE,
      "layout.tsx": PAGE,
      "not-found.stsx": PAGE,
      "not-found.tsx": PAGE,
    });
    expect(manifest.routes.map((route) => route.file)).toEqual([
      "src/routes/about/page.stsx",
      "src/routes/feed/page.stsx",
      "src/routes/(marketing)/pricing/page.stsx",
      "src/routes/blog/[id]/page.stsx",
    ]);
    expect(manifest.diagnostics.map(({ code, file }) => `${code} ${file}`)).toEqual([
      "LUM5003 src/routes/layout.tsx",
      "LUM5003 src/routes/not-found.tsx",
      "LUM5003 src/routes/about/page.tsx",
      "LUM5003 src/routes/blog/[slug]/page.stsx",
      "LUM5003 src/routes/feed/route.ts",
      "LUM5003 src/routes/pricing/page.tsx",
    ]);
    expect(manifest.diagnostics[4]).toMatchObject({
      message: `Duplicate route "/feed": "src/routes/feed/page.stsx" already serves the same URLs.`,
      help: "A folder has either a page or a route.ts endpoint: move one of them to another folder.",
    });
  });

  it("reports LUM5003 when an optional segment serves the URL of another route", () => {
    const manifest = manifestOf({
      "docs/page.stsx": PAGE,
      "docs/[[...path]]/page.stsx": PAGE,
      "about/page.stsx": PAGE,
      "[[lang]]/about/page.stsx": PAGE,
      "[[lang]]/contact/page.stsx": PAGE,
    });
    expect(manifest.routes.map((route) => route.pattern)).toEqual([
      "/about",
      // By its most specific URL, /contact.
      "/[[lang]]/contact",
      "/docs",
    ]);
    expect(
      manifest.diagnostics.map(({ code, file, message }) => ({ code, file, message })),
    ).toEqual([
      {
        code: "LUM5003",
        file: "src/routes/[[lang]]/about/page.stsx",
        message: `Duplicate route "/[[lang]]/about": "src/routes/about/page.stsx" already serves "/about".`,
      },
      {
        code: "LUM5003",
        file: "src/routes/docs/[[...path]]/page.stsx",
        message: `Duplicate route "/docs/[[...path]]": "src/routes/docs/page.stsx" already serves "/docs".`,
      },
    ]);
  });

  it("reports LUM5005 for static endpoints exporting other methods than GET", () => {
    const manifest = manifestOf({
      "feed.xml/route.ts": "export const GET = () => new Response();",
      "api/subscribe/route.ts":
        "export const GET = () => new Response();\nexport function POST() {}",
      "api/live/route.ts": 'export const mode = "server";\nexport function POST() {}',
    });
    expect(manifest.diagnostics).toEqual([
      {
        code: "LUM5005",
        severity: "error",
        file: "src/routes/api/subscribe/route.ts",
        message:
          "This endpoint is static (prerendered to a file at build time), so it can only serve GET, but it exports POST.",
        help: 'Serve it per request with export const mode = "server", or keep only GET.',
      },
    ]);
    expect(manifest.routes.map((route) => route.pattern)).toContain("/api/subscribe");
  });

  it("supports a custom routes directory", () => {
    const manifest = manifestOf({ "page.stsx": PAGE }, "./app/pages/");
    expect(manifest.routesDir).toBe("app/pages");
    expect(manifest.routes[0]?.file).toBe("app/pages/page.stsx");
  });

  it("uses an injected module meta reader", () => {
    const manifest = createRouteManifest([{ path: "page.stsx", source: "" }], {
      readMeta: () => ({ mode: "server", problems: [] }),
    });
    expect(manifest.routes[0]?.mode).toBe("server");
  });
});
