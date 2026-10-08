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
      "index.stsx": PAGE,
      "blog/[slug].stsx": PAGE,
      "docs/[...path].tsx": PAGE,
      "api/posts.ts": "export const GET = () => new Response();",
    });
    expect(manifest.diagnostics).toEqual([]);
    expect(
      manifest.routes.map(({ kind, pattern, params, file }) => ({ kind, pattern, params, file })),
    ).toEqual([
      { kind: "page", pattern: "/", params: [], file: "src/routes/index.stsx" },
      { kind: "endpoint", pattern: "/api/posts", params: [], file: "src/routes/api/posts.ts" },
      {
        kind: "page",
        pattern: "/blog/[slug]",
        params: [{ name: "slug", rest: false }],
        file: "src/routes/blog/[slug].stsx",
      },
      {
        kind: "page",
        pattern: "/docs/[...path]",
        params: [{ name: "path", rest: true }],
        file: "src/routes/docs/[...path].tsx",
      },
    ]);
  });

  it("resolves modes: own export, else the nearest layout, else static", () => {
    const manifest = manifestOf({
      "_layout.stsx": PAGE,
      "index.stsx": PAGE,
      "blog/_layout.stsx": `export const mode = "server";`,
      "blog/index.stsx": PAGE,
      "blog/[slug].stsx": `export const mode = "static";`,
      "blog/drafts/index.stsx": PAGE,
      "blog/(admin)/_layout.stsx": PAGE,
      "blog/(admin)/edit.stsx": PAGE,
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
      "_layout.stsx": PAGE,
      "(shop)/_layout.stsx": PAGE,
      "(shop)/cart/_layout.tsx": PAGE,
      "(shop)/cart/index.stsx": PAGE,
      "about.stsx": PAGE,
    });
    expect(page(manifest, "/cart").layouts).toEqual([
      "src/routes/_layout.stsx",
      "src/routes/(shop)/_layout.stsx",
      "src/routes/(shop)/cart/_layout.tsx",
    ]);
    expect(page(manifest, "/about").layouts).toEqual(["src/routes/_layout.stsx"]);
  });

  it("resolves ssr for spa routes only and warns about ssr = false elsewhere", () => {
    const manifest = manifestOf({
      "app/_layout.stsx": `export const mode = "spa";\nexport const ssr = false;`,
      "app/index.stsx": PAGE,
      "app/settings.stsx": "export const ssr = true;",
      "app/report.stsx": `export const mode = "server";`,
      "about.stsx": "export const ssr = false;",
    });
    expect(page(manifest, "/app")).toMatchObject({ mode: "spa", ssr: false });
    expect(page(manifest, "/app/settings")).toMatchObject({ mode: "spa", ssr: true });
    expect(page(manifest, "/app/report")).toMatchObject({ mode: "server", ssr: true });
    expect(page(manifest, "/about")).toMatchObject({ mode: "static", ssr: true });
    expect(manifest.diagnostics).toMatchObject([
      { code: "LUM5002", severity: "warning", file: "src/routes/about.stsx" },
    ]);
  });

  it("gives endpoints a static or server mode, serving spa subtrees live", () => {
    const manifest = manifestOf({
      "sitemap.xml.ts": "",
      "api/_layout.stsx": `export const mode = "server";`,
      "api/posts.ts": "",
      "api/feed.ts": `export const mode = "static";`,
      "app/_layout.stsx": `export const mode = "spa";`,
      "app/todos.ts": "",
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
        "index.stsx": PAGE,
        "about.stsx": `export const mode = "static";`,
        "admin/_layout.stsx": `export const mode = "server";`,
        "admin/users.stsx": PAGE,
        "editor.stsx": `export const ssr = true;`,
        "api/todos.ts": "",
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

  it("links each page to its nearest _error and _404 pages", () => {
    const manifest = manifestOf({
      "_404.stsx": PAGE,
      "_error.stsx": PAGE,
      "blog/_404.stsx": PAGE,
      "blog/[slug].stsx": PAGE,
      "about.stsx": PAGE,
    });
    expect(page(manifest, "/blog/[slug]")).toMatchObject({
      notFoundPage: "src/routes/blog/_404.stsx",
      errorPage: "src/routes/_error.stsx",
    });
    expect(page(manifest, "/about")).toMatchObject({
      notFoundPage: "src/routes/_404.stsx",
      errorPage: "src/routes/_error.stsx",
    });
    expect(manifest.notFoundPages.map(({ file, pattern }) => ({ file, pattern }))).toEqual([
      { file: "src/routes/_404.stsx", pattern: "/" },
      { file: "src/routes/blog/_404.stsx", pattern: "/blog" },
    ]);
    expect(manifest.errorPages.map((entry) => entry.file)).toEqual(["src/routes/_error.stsx"]);
  });

  it("reports LUM5002 for invalid route files and drops them", () => {
    const manifest = manifestOf({
      "index.stsx": PAGE,
      "_card.stsx": PAGE,
      "blog/[slug.stsx": PAGE,
      "docs/[...path]/edit.stsx": PAGE,
    });
    expect(manifest.routes.map((route) => route.pattern)).toEqual(["/"]);
    expect(
      manifest.diagnostics.map(({ code, severity, file }) => ({ code, severity, file })),
    ).toEqual([
      { code: "LUM5002", severity: "error", file: "src/routes/_card.stsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/blog/[slug.stsx" },
      { code: "LUM5002", severity: "error", file: "src/routes/docs/[...path]/edit.stsx" },
    ]);
    expect(manifest.diagnostics[0]?.help).toContain("src/lib");
  });

  it("reports LUM5002 for invalid or unreadable mode exports and falls back to inheritance", () => {
    const manifest = manifestOf({
      "_layout.stsx": `export const mode = "server";`,
      "a.stsx": `export const mode = "dynamic";`,
      "b.stsx": "export const mode = MODE;",
      "c.ts": `export const mode = "spa";`,
    });
    expect(manifest.routes.map((route) => [route.pattern, route.mode])).toEqual([
      ["/a", "server"],
      ["/b", "server"],
      ["/c", "server"],
    ]);
    expect(
      manifest.diagnostics.map(({ code, file, message }) => ({ code, file, message })),
    ).toEqual([
      { code: "LUM5002", file: "src/routes/a.stsx", message: `Invalid mode "dynamic" for a page.` },
      {
        code: "LUM5002",
        file: "src/routes/b.stsx",
        message: `"export const mode" must be a string literal, for example "server".`,
      },
      { code: "LUM5002", file: "src/routes/c.ts", message: `Invalid mode "spa" for an endpoint.` },
    ]);
  });

  it("reports LUM5003 when two files serve the same URLs and keeps the first", () => {
    const manifest = manifestOf({
      "about.stsx": PAGE,
      "about/index.stsx": PAGE,
      "(marketing)/pricing.stsx": PAGE,
      "pricing.tsx": PAGE,
      "blog/[id].stsx": PAGE,
      "blog/[slug].stsx": PAGE,
      "feed.ts": "",
      "feed.stsx": PAGE,
      "_layout.stsx": PAGE,
      "_layout.tsx": PAGE,
      "_404.stsx": PAGE,
      "_404.tsx": PAGE,
    });
    expect(manifest.routes.map((route) => route.file)).toEqual([
      "src/routes/about.stsx",
      "src/routes/feed.stsx",
      "src/routes/(marketing)/pricing.stsx",
      "src/routes/blog/[id].stsx",
    ]);
    expect(manifest.diagnostics.map(({ code, file }) => `${code} ${file}`)).toEqual([
      "LUM5003 src/routes/_404.tsx",
      "LUM5003 src/routes/_layout.tsx",
      "LUM5003 src/routes/about/index.stsx",
      "LUM5003 src/routes/blog/[slug].stsx",
      "LUM5003 src/routes/feed.ts",
      "LUM5003 src/routes/pricing.tsx",
    ]);
    expect(manifest.diagnostics[2]?.message).toBe(
      `Duplicate route "/about": "src/routes/about.stsx" already serves the same URLs.`,
    );
  });

  it("reports LUM5005 for static endpoints exporting other methods than GET", () => {
    const manifest = manifestOf({
      "feed.xml.ts": "export const GET = () => new Response();",
      "api/subscribe.ts": "export const GET = () => new Response();\nexport function POST() {}",
      "api/live.ts": 'export const mode = "server";\nexport function POST() {}',
    });
    expect(manifest.diagnostics).toEqual([
      {
        code: "LUM5005",
        severity: "error",
        file: "src/routes/api/subscribe.ts",
        message:
          "This endpoint is static (prerendered to a file at build time), so it can only serve GET, but it exports POST.",
        help: 'Serve it per request with export const mode = "server", or keep only GET.',
      },
    ]);
    expect(manifest.routes.map((route) => route.pattern)).toContain("/api/subscribe");
  });

  it("supports a custom routes directory", () => {
    const manifest = manifestOf({ "index.stsx": PAGE }, "./app/pages/");
    expect(manifest.routesDir).toBe("app/pages");
    expect(manifest.routes[0]?.file).toBe("app/pages/index.stsx");
  });

  it("uses an injected module meta reader", () => {
    const manifest = createRouteManifest([{ path: "index.stsx", source: "" }], {
      readMeta: () => ({ mode: "server", problems: [] }),
    });
    expect(manifest.routes[0]?.mode).toBe("server");
  });
});
