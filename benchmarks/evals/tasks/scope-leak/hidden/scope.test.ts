import { describe, expect, it } from "vitest";
import { buildCss, source } from "./helpers.ts";

const rules = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1]!
      .trim()
      .split(",")
      .map((s) => s.trim()),
    body: m[2]!.toLowerCase(),
  }));

describe("Notice styles", () => {
  const css = buildCss();
  const notice = rules(css).filter((rule) => /#b91c1c|#fef2f2|uppercase/.test(rule.body));

  it("still has the notice's declarations", () => {
    const all = notice.map((rule) => rule.body).join(";");
    expect(all).toContain("#b91c1c");
    expect(all).toContain("#fef2f2");
    expect(all).toContain("uppercase");
  });

  it("scopes every notice rule", () => {
    expect(notice.length).toBeGreaterThan(0);
    for (const rule of notice)
      for (const selector of rule.selectors) expect(selector).toMatch(/\[data-l-[a-z0-9]+\]/);
  });

  it("uses a scoped style block, not a global one", () => {
    expect(source("src/components/Notice.stsx")).not.toMatch(/<style\s+global/);
  });
});
