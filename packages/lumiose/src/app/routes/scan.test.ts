import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scanRoutes } from "@lumiose/vite/internal/app/routes/scan.ts";

const BASIC = fileURLToPath(new URL("./__fixtures__/basic", import.meta.url));

describe("scanRoutes", () => {
  it("scans the basic fixture into a manifest", async () => {
    const manifest = await scanRoutes(BASIC);
    expect(manifest.diagnostics).toEqual([]);
    expect(manifest.routes.map(({ kind, pattern, mode }) => `${kind} ${mode} ${pattern}`)).toEqual([
      "page static /",
      "page static /about",
      "page spa /app",
      "page server /blog",
      "page static /pricing",
      "endpoint static /sitemap.xml",
      "endpoint server /api/posts",
      "endpoint server /app/data.json",
      "page spa /app/settings",
      "page server /blog/new",
      "endpoint static /api/posts/[id]",
      "page static /blog/[slug]",
      "page server /shop/[category]/[item]",
      "page static /docs/[...path]",
    ]);
  });

  it("records layouts, special pages and spa options from the files", async () => {
    const manifest = await scanRoutes(BASIC);
    const byPattern = new Map(manifest.routes.map((route) => [route.pattern, route]));
    expect(byPattern.get("/blog/[slug]")).toEqual({
      kind: "page",
      pattern: "/blog/[slug]",
      segments: [
        { kind: "static", value: "blog" },
        { kind: "param", name: "slug" },
      ],
      params: [{ name: "slug", rest: false, optional: false }],
      file: "src/routes/blog/[slug]/page.stsx",
      mode: "static",
      ssr: true,
      prerender: false,
      layouts: ["src/routes/layout.stsx", "src/routes/blog/layout.stsx"],
      errorPage: "src/routes/error.stsx",
      notFoundPage: "src/routes/blog/not-found.stsx",
    });
    expect(byPattern.get("/pricing")).toMatchObject({
      layouts: ["src/routes/layout.stsx", "src/routes/(marketing)/layout.stsx"],
    });
    expect(byPattern.get("/app")).toMatchObject({ mode: "spa", ssr: false });
    expect(byPattern.get("/app/settings")).toMatchObject({ mode: "spa", ssr: true });
    expect(manifest.layouts.map((layout) => `${layout.mode} ${layout.file}`)).toEqual([
      "static src/routes/layout.stsx",
      "static src/routes/(marketing)/layout.stsx",
      "spa src/routes/app/layout.stsx",
      "server src/routes/blog/layout.stsx",
    ]);
  });

  it("returns an empty manifest when the routes directory is missing", async () => {
    const manifest = await scanRoutes(BASIC, { routesDir: "src/missing" });
    expect(manifest).toMatchObject({
      routesDir: "src/missing",
      routes: [],
      layouts: [],
      diagnostics: [],
    });
  });
});
