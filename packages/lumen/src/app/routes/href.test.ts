import { describe, expect, it } from "vitest";
import { href } from "./href.ts";

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
