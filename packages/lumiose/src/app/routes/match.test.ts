import { describe, expect, it } from "vitest";
import { createRouteManifest } from "./manifest.ts";
import { createRouteMatcher, matchSegments, splitPathname } from "./match.ts";

const matcherOf = (paths: string[]) =>
  createRouteMatcher(createRouteManifest(paths.map((path) => ({ path, source: "" }))));

describe("createRouteMatcher", () => {
  const matcher = matcherOf([
    "page.stsx",
    "about/page.stsx",
    "(marketing)/pricing/page.stsx",
    "blog/page.stsx",
    "blog/new/page.stsx",
    "blog/[slug]/page.stsx",
    "blog/[slug]/comments/page.stsx",
    "docs/page.stsx",
    "docs/[...path]/page.stsx",
    "[lang]/about/page.stsx",
    "[...all]/page.stsx",
    "shop/[category]/[item]/page.stsx",
    "sitemap.xml/route.ts",
    "api/posts/[id]/route.ts",
  ]);
  const match = (pathname: string) => {
    const result = matcher.match(pathname);
    return result === null ? null : [result.route.pattern, result.params];
  };

  it("matches static routes, folder pages and groups", () => {
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

  it("lets a rest param match one or more segments", () => {
    expect(match("/docs")).toEqual(["/docs", {}]);
    expect(match("/docs/")).toEqual(["/docs", {}]);
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
    const strict = matcherOf(["page.stsx", "blog/[slug]/page.stsx", "files/[...path]/page.stsx"]);
    expect(strict.match("/blog")).toBeNull();
    expect(strict.match("/blog/a/b")).toBeNull();
    expect(strict.match("/about")).toBeNull();
    expect(strict.match("/files")).toBeNull();
    expect(strict.match("/files/a")?.params).toEqual({ path: "a" });
  });

  it("is case-sensitive", () => {
    expect(match("/About")).toEqual(["/[...all]", { all: "About" }]);
  });
});

describe("optional segments", () => {
  const matcher = matcherOf([
    "[[lang]]/about/page.stsx",
    "[slug]/page.stsx",
    "docs/[[...path]]/page.stsx",
    "docs/api/page.stsx",
    "files/[[...path]]/route.ts",
  ]);
  const match = (pathname: string) => {
    const result = matcher.match(pathname);
    return result === null ? null : [result.route.pattern, result.params];
  };

  it("matches [[param]] with and without its segment, omitting the absent param", () => {
    expect(match("/about")).toEqual(["/[[lang]]/about", {}]);
    expect(match("/es/about")).toEqual(["/[[lang]]/about", { lang: "es" }]);
    expect(match("/es")).toEqual(["/[slug]", { slug: "es" }]);
  });

  it("matches [[...rest]] with zero or more segments", () => {
    expect(match("/docs")).toEqual(["/docs/[[...path]]", {}]);
    expect(match("/docs/guide/routing")).toEqual(["/docs/[[...path]]", { path: "guide/routing" }]);
    expect(match("/docs/api")).toEqual(["/docs/api", {}]);
    expect(match("/files")).toEqual(["/files/[[...path]]", {}]);
  });

  it("ranks each URL shape on its own: static beats param", () => {
    const ranked = matcherOf(["[[lang]]/[slug]/page.stsx", "blog/page.stsx"]);
    expect(ranked.match("/blog")?.route.pattern).toBe("/blog");
    expect(ranked.match("/post")?.params).toEqual({ slug: "post" });
    expect(ranked.match("/es/post")?.params).toEqual({ lang: "es", slug: "post" });
  });

  it("matches optional segments with matchSegments", () => {
    const segments = createRouteManifest([
      { path: "[[lang]]/docs/[[...path]]/page.stsx", source: "" },
    ]).routes[0]!.segments;
    expect(matchSegments(segments, ["docs"])).toEqual({});
    expect(matchSegments(segments, ["fr", "docs", "a", "b"])).toEqual({ lang: "fr", path: "a/b" });
    expect(matchSegments(segments, ["fr"])).toBeNull();
  });
});

describe("RouteMatcher.notFound", () => {
  it("picks the not-found page with the deepest matching scope", () => {
    const matcher = matcherOf([
      "not-found.stsx",
      "(marketing)/not-found.stsx",
      "blog/not-found.stsx",
      "shop/[category]/not-found.stsx",
      "page.stsx",
    ]);
    expect(matcher.notFound("/missing")?.file).toBe("src/routes/not-found.stsx");
    expect(matcher.notFound("/blog/missing/deep")?.file).toBe("src/routes/blog/not-found.stsx");
    expect(matcher.notFound("/shop/books/missing")?.file).toBe(
      "src/routes/shop/[category]/not-found.stsx",
    );
    expect(matcher.notFound("/shop")?.file).toBe("src/routes/not-found.stsx");
  });

  it("covers the URLs with and without an optional scope segment", () => {
    const matcher = matcherOf(["not-found.stsx", "[[lang]]/docs/not-found.stsx"]);
    expect(matcher.notFound("/docs/missing")?.file).toBe("src/routes/[[lang]]/docs/not-found.stsx");
    expect(matcher.notFound("/es/docs/missing")?.file).toBe(
      "src/routes/[[lang]]/docs/not-found.stsx",
    );
    expect(matcher.notFound("/es/blog")?.file).toBe("src/routes/not-found.stsx");
  });

  it("returns undefined without not-found pages", () => {
    expect(matcherOf(["page.stsx"]).notFound("/x")).toBeUndefined();
  });
});

describe("splitPathname", () => {
  it("splits and decodes", () => {
    expect(splitPathname("/a/b%2Fc/")).toEqual(["a", "b/c"]);
    expect(splitPathname("")).toEqual([]);
  });
});
