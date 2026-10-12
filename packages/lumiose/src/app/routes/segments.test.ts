import { describe, expect, it } from "vitest";
import {
  classifyRouteFile,
  compareSegments,
  formatPattern,
  isRouteModuleCandidate,
  routeVariants,
  type RouteSegment,
} from "./segments.ts";

const route = (path: string) => {
  const result = classifyRouteFile(path);
  if (result.status !== "route") throw new Error(`${path}: ${JSON.stringify(result)}`);
  return { kind: result.kind, dir: result.dir, pattern: formatPattern(result.segments) };
};

describe("classifyRouteFile", () => {
  it.each([
    ["page.stsx", "page", "", "/"],
    ["about/page.tsx", "page", "about", "/about"],
    ["blog/page.stsx", "page", "blog", "/blog"],
    ["blog/[slug]/page.stsx", "page", "blog/[slug]", "/blog/[slug]"],
    ["docs/[...path]/page.stsx", "page", "docs/[...path]", "/docs/[...path]"],
    ["docs/[[...path]]/page.stsx", "page", "docs/[[...path]]", "/docs/[[...path]]"],
    ["[[lang]]/about/page.stsx", "page", "[[lang]]/about", "/[[lang]]/about"],
    ["(marketing)/pricing/page.stsx", "page", "(marketing)/pricing", "/pricing"],
    ["(a)/(b)/page.stsx", "page", "(a)/(b)", "/"],
    [
      "shop/[category]/[item]/page.stsx",
      "page",
      "shop/[category]/[item]",
      "/shop/[category]/[item]",
    ],
    ["index/page.stsx", "page", "index", "/index"],
    ["api/posts/route.ts", "endpoint", "api/posts", "/api/posts"],
    ["route.ts", "endpoint", "", "/"],
    ["sitemap.xml/route.ts", "endpoint", "sitemap.xml", "/sitemap.xml"],
    ["feed.rss/page.stsx", "page", "feed.rss", "/feed.rss"],
    ["layout.stsx", "layout", "", "/"],
    ["blog/layout.tsx", "layout", "blog", "/blog"],
    ["blog/not-found.stsx", "notFound", "blog", "/blog"],
    ["(shop)/error.stsx", "error", "(shop)", "/"],
    ["[[lang]]/layout.stsx", "layout", "[[lang]]", "/[[lang]]"],
  ])("%s → %s %s", (path, kind, dir, pattern) => {
    expect(route(path)).toEqual({ kind, dir, pattern });
  });

  it.each([
    // Colocated modules: anything that is not a route file name.
    "styles.css",
    "readme.md",
    "types.d.ts",
    "page.d.ts",
    "helpers.ts",
    "index.stsx",
    "about.stsx",
    "blog/[slug].stsx",
    "blog/Card.stsx",
    "blog/page.test.ts",
    "blog/page.spec.tsx",
    "sitemap.xml.ts",
    "_layout.stsx",
    "_404.stsx",
    "_helpers.ts",
    ".DS_Store",
    // Private and hidden folders: nothing below them routes.
    "_components/page.stsx",
    "blog/_lib/route.ts",
    "blog/_drafts/[slug]/page.stsx",
    "_private/loading.stsx",
    ".drafts/page.stsx",
    "blog/.cache/route.ts",
    // Invalid folder names hold colocated modules only.
    "my folder/helpers.ts",
  ])("ignores %s", (path) => {
    expect(classifyRouteFile(path)).toEqual({ status: "ignored" });
  });

  it.each([
    ["page.ts", "must be a component file"],
    ["layout.ts", "must be a component file"],
    ["not-found.ts", "must be a component file"],
    ["error.ts", "must be a component file"],
    ["api/route.tsx", "an endpoint is a route.ts file"],
    ["api/route.stsx", "an endpoint is a route.ts file"],
    ["loading.stsx", "no loading files"],
    ["blog/template.tsx", "no template files"],
    ["blog/default.tsx", "no default files"],
    ["global-error.stsx", "no global-error files"],
    ["@modal/page.stsx", "no parallel routes"],
    ["blog/(.)photo/page.stsx", "no intercepting routes"],
    ["(..)(..)photo/page.stsx", "no intercepting routes"],
    ["(...)photo/layout.stsx", "no intercepting routes"],
    ["(broken/page.stsx", "not a valid route group"],
    ["blog/[slug/page.stsx", "not a valid route segment"],
    ["blog/post-[id]/page.stsx", "not a valid route segment"],
    ["blog/[slug].json/route.ts", "not a valid route segment"],
    ["blog/[]/page.stsx", "not a valid param name"],
    ["blog/[...]/page.stsx", "not a valid param name"],
    ["blog/[[]]/page.stsx", "not a valid param name"],
    ["blog/[[...]]/page.stsx", "not a valid param name"],
    ["blog/[my-slug]/page.stsx", "not a valid param name"],
    ["blog/[__proto__]/page.stsx", "not a valid param name"],
    ["blog/[[slug]/page.stsx", "not a valid route segment"],
    ["my page/page.stsx", "not a valid route segment"],
    ["what?/page.stsx", "not a valid route segment"],
    ["docs/[...path]/edit/page.stsx", "must be the last segment"],
    ["docs/[[...path]]/edit/page.stsx", "must be the last segment"],
    ["[...a]/[...b]/page.stsx", "must be the last segment"],
    ["[id]/[id]/page.stsx", 'uses the param "id" twice'],
    ["[[id]]/[id]/page.stsx", 'uses the param "id" twice'],
  ])("rejects %s", (path, message) => {
    const result = classifyRouteFile(path);
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.message).toContain(message);
  });
});

describe("isRouteModuleCandidate", () => {
  it("accepts route file names and the unsupported Next.js special files only", () => {
    const names = [
      "page.stsx",
      "page.tsx",
      "route.ts",
      "layout.stsx",
      "not-found.tsx",
      "error.stsx",
      "loading.tsx",
      "page.ts",
      "Card.stsx",
      "index.stsx",
      "helpers.ts",
      "page.test.ts",
      "page.css",
    ];
    expect(names.filter(isRouteModuleCandidate)).toEqual([
      "page.stsx",
      "page.tsx",
      "route.ts",
      "layout.stsx",
      "not-found.tsx",
      "error.stsx",
      "loading.tsx",
      "page.ts",
    ]);
  });
});

const s = (value: string): RouteSegment => ({ kind: "static", value });
const p = (name: string): RouteSegment => ({ kind: "param", name });
const r = (name: string): RouteSegment => ({ kind: "rest", name });
const o = (name: string): RouteSegment => ({ kind: "optional", name });
const or = (name: string): RouteSegment => ({ kind: "optionalRest", name });

describe("compareSegments", () => {
  it("orders static before param before rest, position by position", () => {
    const routes = [
      [r("all")],
      [p("id")],
      [s("a"), r("x")],
      [s("a"), p("id")],
      [s("a"), s("b")],
      [p("x"), s("b")],
      [],
    ];
    const sorted = routes.toSorted(compareSegments).map(formatPattern);
    expect(sorted).toEqual(["/", "/a/b", "/a/[id]", "/a/[...x]", "/[id]", "/[x]/b", "/[...all]"]);
  });

  it("puts an exact route before a trailing rest of the same prefix", () => {
    expect(compareSegments([s("docs")], [s("docs"), r("path")])).toBeLessThan(0);
  });
});

const variants = (segments: RouteSegment[]) => routeVariants(segments).map(formatPattern);

describe("routeVariants", () => {
  it("is the route itself without optional segments", () => {
    expect(variants([s("blog"), p("slug")])).toEqual(["/blog/[slug]"]);
  });

  it("expands optional segments into the shapes with and without them, by priority", () => {
    expect(variants([o("lang"), s("about")])).toEqual(["/about", "/[lang]/about"]);
    expect(variants([s("docs"), or("path")])).toEqual(["/docs", "/docs/[...path]"]);
    expect(variants([o("lang"), s("docs"), or("path")])).toEqual([
      "/docs",
      "/docs/[...path]",
      "/[lang]/docs",
      "/[lang]/docs/[...path]",
    ]);
  });

  it("keeps the first of shapes that serve the same URLs", () => {
    expect(variants([o("a"), o("b")])).toEqual(["/", "/[a]", "/[a]/[b]"]);
  });
});
