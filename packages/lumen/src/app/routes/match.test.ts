import { describe, expect, it } from "vitest";
import { createRouteManifest } from "./manifest.ts";
import { createRouteMatcher, splitPathname } from "./match.ts";

const matcherOf = (paths: string[]) =>
  createRouteMatcher(createRouteManifest(paths.map((path) => ({ path, source: "" }))));

describe("createRouteMatcher", () => {
  const matcher = matcherOf([
    "index.stsx",
    "about.stsx",
    "(marketing)/pricing.stsx",
    "blog/index.stsx",
    "blog/new.stsx",
    "blog/[slug].stsx",
    "blog/[slug]/comments.stsx",
    "docs/index.stsx",
    "docs/[...path].stsx",
    "[lang]/about.stsx",
    "[...all].stsx",
    "shop/[category]/[item].stsx",
    "sitemap.xml.ts",
    "api/posts/[id].ts",
  ]);
  const match = (pathname: string) => {
    const result = matcher.match(pathname);
    return result === null ? null : [result.route.pattern, result.params];
  };

  it("matches static routes, index files and groups", () => {
    expect(match("/")).toEqual(["/", {}]);
    expect(match("/about")).toEqual(["/about", {}]);
    expect(match("/pricing")).toEqual(["/pricing", {}]);
    expect(match("/blog")).toEqual(["/blog", {}]);
    expect(match("/sitemap.xml")).toEqual(["/sitemap.xml", {}]);
  });

  it("prefers static over param over rest, segment by segment", () => {
    expect(match("/blog/new")).toEqual(["/blog/new", {}]);
    expect(match("/blog/hello")).toEqual(["/blog/[slug]", { slug: "hello" }]);
    expect(match("/blog/hello/comments")).toEqual(["/blog/[slug]/comments", { slug: "hello" }]);
    expect(match("/en/about")).toEqual(["/[lang]/about", { lang: "en" }]);
    expect(match("/blog/hello/likes")).toEqual(["/[...all]", { all: "blog/hello/likes" }]);
    expect(match("/shop/books/dune")).toEqual([
      "/shop/[category]/[item]",
      { category: "books", item: "dune" },
    ]);
    expect(match("/api/posts/7")).toEqual(["/api/posts/[id]", { id: "7" }]);
  });

  it("lets a rest param match zero or more segments, after an exact match", () => {
    expect(match("/docs")).toEqual(["/docs", {}]);
    expect(match("/docs/guide")).toEqual(["/docs/[...path]", { path: "guide" }]);
    expect(match("/docs/guide/routing/files")).toEqual([
      "/docs/[...path]",
      { path: "guide/routing/files" },
    ]);
    expect(match("/nowhere")).toEqual(["/[...all]", { all: "nowhere" }]);
  });

  it("normalizes slashes, ignores query and hash, and decodes params", () => {
    expect(match("/blog/new/")).toEqual(["/blog/new", {}]);
    expect(match("//blog//new")).toEqual(["/blog/new", {}]);
    expect(match("/blog/hello?draft=1#top")).toEqual(["/blog/[slug]", { slug: "hello" }]);
    expect(match("/blog/caf%C3%A9%20au%20lait")).toEqual([
      "/blog/[slug]",
      { slug: "café au lait" },
    ]);
    expect(match("/blog/%E0%A4%A")).toEqual(["/blog/[slug]", { slug: "%E0%A4%A" }]);
  });

  it("returns null when nothing matches", () => {
    const strict = matcherOf(["index.stsx", "blog/[slug].stsx"]);
    expect(strict.match("/blog")).toBeNull();
    expect(strict.match("/blog/a/b")).toBeNull();
    expect(strict.match("/about")).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(match("/About")).toEqual(["/[...all]", { all: "About" }]);
  });
});

describe("RouteMatcher.notFound", () => {
  it("picks the _404 page with the deepest matching scope", () => {
    const matcher = matcherOf([
      "_404.stsx",
      "(marketing)/_404.stsx",
      "blog/_404.stsx",
      "shop/[category]/_404.stsx",
      "index.stsx",
    ]);
    expect(matcher.notFound("/missing")?.file).toBe("src/routes/_404.stsx");
    expect(matcher.notFound("/blog/missing/deep")?.file).toBe("src/routes/blog/_404.stsx");
    expect(matcher.notFound("/shop/books/missing")?.file).toBe(
      "src/routes/shop/[category]/_404.stsx",
    );
    expect(matcher.notFound("/shop")?.file).toBe("src/routes/_404.stsx");
  });

  it("returns undefined without _404 pages", () => {
    expect(matcherOf(["index.stsx"]).notFound("/x")).toBeUndefined();
  });
});

describe("splitPathname", () => {
  it("splits and decodes", () => {
    expect(splitPathname("/a/b%2Fc/")).toEqual(["a", "b/c"]);
    expect(splitPathname("")).toEqual([]);
  });
});
