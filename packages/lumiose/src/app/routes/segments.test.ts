import { describe, expect, it } from "vitest";
import {
  classifyRouteFile,
  compareSegments,
  formatPattern,
  type RouteSegment,
} from "./segments.ts";

const route = (path: string) => {
  const result = classifyRouteFile(path);
  if (result.status !== "route") throw new Error(`${path}: ${JSON.stringify(result)}`);
  return { kind: result.kind, dir: result.dir, pattern: formatPattern(result.segments) };
};

describe("classifyRouteFile", () => {
  it.each([
    ["index.stsx", "page", "", "/"],
    ["about.tsx", "page", "", "/about"],
    ["blog/index.stsx", "page", "blog", "/blog"],
    ["blog/[slug].stsx", "page", "blog", "/blog/[slug]"],
    ["docs/[...path].stsx", "page", "docs", "/docs/[...path]"],
    ["docs/[...path]/index.stsx", "page", "docs/[...path]", "/docs/[...path]"],
    ["(marketing)/pricing.stsx", "page", "(marketing)", "/pricing"],
    ["(a)/(b)/index.stsx", "page", "(a)/(b)", "/"],
    ["shop/[category]/[item].stsx", "page", "shop/[category]", "/shop/[category]/[item]"],
    ["index/page.stsx", "page", "index", "/index/page"],
    ["api/posts.ts", "endpoint", "api", "/api/posts"],
    ["api/index.ts", "endpoint", "api", "/api"],
    ["sitemap.xml.ts", "endpoint", "", "/sitemap.xml"],
    ["feed.rss.stsx", "page", "", "/feed.rss"],
    ["_layout.stsx", "layout", "", "/"],
    ["blog/_layout.tsx", "layout", "blog", "/blog"],
    ["blog/_404.stsx", "notFound", "blog", "/blog"],
    ["(shop)/_error.stsx", "error", "(shop)", "/"],
  ])("%s → %s %s", (path, kind, dir, pattern) => {
    expect(route(path)).toEqual({ kind, dir, pattern });
  });

  it.each([
    "styles.css",
    "readme.md",
    "types.d.ts",
    "blog/post.test.ts",
    "blog/post.spec.tsx",
    ".DS_Store",
    ".drafts/index.stsx",
    "blog/.cache/x.ts",
  ])("ignores %s", (path) => {
    expect(classifyRouteFile(path)).toEqual({ status: "ignored" });
  });

  it.each([
    ["_helpers.ts", "only _layout, _404 and _error"],
    ["blog/_card.stsx", "only _layout, _404 and _error"],
    ["_layout.ts", "must be a page file"],
    ["_404.ts", "must be a page file"],
    ["(group).stsx", "route groups must be folders"],
    ["(broken/index.stsx", "not a valid route group"],
    ["blog/[slug.stsx", "not a valid route segment"],
    ["blog/post-[id].stsx", "not a valid route segment"],
    ["blog/[slug].json.ts", "not a valid route segment"],
    ["blog/[].stsx", "not a valid param name"],
    ["blog/[...].stsx", "not a valid param name"],
    ["blog/[my-slug].stsx", "not a valid param name"],
    ["blog/[__proto__].stsx", "not a valid param name"],
    ["blog/[[slug]].stsx", "optional params are not supported"],
    ["my page.stsx", "not a valid route segment"],
    ["what?.stsx", "not a valid route segment"],
    ["docs/[...path]/edit.stsx", "must be the last segment"],
    ["[...a]/[...b].stsx", "must be the last segment"],
    ["[id]/[id].stsx", 'uses the param "id" twice'],
  ])("rejects %s", (path, message) => {
    const result = classifyRouteFile(path);
    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && result.message).toContain(message);
  });
});

const s = (value: string): RouteSegment => ({ kind: "static", value });
const p = (name: string): RouteSegment => ({ kind: "param", name });
const r = (name: string): RouteSegment => ({ kind: "rest", name });

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
