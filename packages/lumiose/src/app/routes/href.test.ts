import { afterEach, describe, expect, it, vi } from "vitest";
import { appPath, fillPattern, href, normalizeBase } from "./href.ts";

describe("href", () => {
  it("returns static patterns unchanged", () => {
    expect(href("/")).toBe("/");
    expect(href("/about")).toBe("/about");
    expect(href("/sitemap.xml")).toBe("/sitemap.xml");
  });

  it("fills and encodes params", () => {
    expect(href("/blog/[slug]", { slug: "hello-world" })).toBe("/blog/hello-world");
    expect(href("/shop/[category]/[item]", { category: "books & more", item: "a/b" })).toBe(
      "/shop/books%20%26%20more/a%2Fb",
    );
  });

  it("keeps rest separators and drops an empty rest", () => {
    expect(href("/docs/[...path]", { path: "guide/routing files" })).toBe(
      "/docs/guide/routing%20files",
    );
    expect(href("/docs/[...path]", { path: "" })).toBe("/docs");
    expect(href("/[...all]", { all: "" })).toBe("/");
  });

  it("throws on missing or empty params", () => {
    expect(() => href("/blog/[slug]", {})).toThrow(
      `href("/blog/[slug]"): missing value for param "slug".`,
    );
    expect(() => href("/blog/[slug]", { slug: "" })).toThrow(TypeError);
    expect(() => href("/docs/[...path]")).toThrow(TypeError);
  });
});

// Vite fills in `import.meta.env` (BASE_URL, and LUMIOSE_TRAILING_SLASH from `lumiose dev`/`build`).
describe("href below the base, with the trailing-slash policy (TASK-101)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes Vite's base; the root is the base itself", () => {
    vi.stubEnv("BASE_URL", "/lumiose/");
    expect(href("/")).toBe("/lumiose/");
    expect(href("/docs/[...path]", { path: "concepts/signals" })).toBe(
      "/lumiose/docs/concepts/signals",
    );
    expect(href("/docs/[...path]", { path: "" })).toBe("/lumiose/docs");
    vi.stubEnv("BASE_URL", "/lumiose");
    expect(href("/about")).toBe("/lumiose/about");
  });

  it("treats a relative base as the root and keeps a full URL's path", () => {
    vi.stubEnv("BASE_URL", "./");
    expect(href("/about")).toBe("/about");
    vi.stubEnv("BASE_URL", "https://cdn.example.com/site/");
    expect(href("/about")).toBe("/site/about");
  });

  it('adds a trailing slash to pages with "always", not to the root or file-like endpoints', () => {
    vi.stubEnv("BASE_URL", "/sub/");
    vi.stubEnv("LUMIOSE_TRAILING_SLASH", "always");
    expect(href("/")).toBe("/sub/");
    expect(href("/blog/[slug]", { slug: "v1.2" })).toBe("/sub/blog/v1.2/");
    expect(href("/llms.txt")).toBe("/sub/llms.txt");
    expect(href("/docs/[...path]", { path: "a/b" })).toBe("/sub/docs/a/b/");
  });

  it('leaves paths bare with "never" and "ignore"', () => {
    for (const policy of ["never", "ignore"]) {
      vi.stubEnv("LUMIOSE_TRAILING_SLASH", policy);
      expect(href("/")).toBe("/");
      expect(href("/blog/[slug]", { slug: "a" })).toBe("/blog/a");
    }
  });

  it("builds base-less paths for the build (fillPattern, appPath, normalizeBase)", () => {
    vi.stubEnv("BASE_URL", "/sub/");
    expect(fillPattern("/blog/[slug]", { slug: "hola mundo" })).toBe("/blog/hola%20mundo");
    expect(appPath("/", "/sub/", true)).toBe("/sub/");
    expect(appPath("/a", "/sub/", true)).toBe("/sub/a/");
    expect(normalizeBase("")).toBe("/");
    expect(normalizeBase("docs")).toBe("/docs/");
  });
});

describe("dot segments (TASK-165)", () => {
  it("refuses '.' and '..' params, which would resolve into another path", () => {
    expect(() => fillPattern("/files/[name]", { name: ".." })).toThrow(/cannot be "\.\."/);
    expect(() => fillPattern("/files/[name]", { name: "." })).toThrow(/cannot be "\."/);
    expect(() => fillPattern("/docs/[...path]", { path: "a/../../admin" })).toThrow(/\.\./);
    expect(fillPattern("/files/[name]", { name: "..a" })).toBe("/files/..a");
    expect(fillPattern("/files/[name]", { name: "a/../b" })).toBe("/files/a%2F..%2Fb");
  });
});
