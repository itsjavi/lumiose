import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCss, root } from "./helpers.ts";

const classes = (tag: string) =>
  (/class="?([^">]*)"?/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean).toSorted();

describe("class passthrough", () => {
  const css = buildCss();
  const html = readFileSync(join(root, "dist/client/index.html"), "utf8");
  const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);

  it("renders both buttons with their classes", () => {
    const signUp = buttons.find((b) => b.includes("Sign up"))!;
    const learn = buttons.find((b) => b.includes("Learn more"))!;
    expect(classes(signUp)).toEqual(["btn", "cta"]);
    expect(classes(learn)).toEqual(["btn"]);
  });

  it("applies the page's scoped .cta rule to the Sign up button", () => {
    const rule = /\.cta(\[data-l-[a-z0-9]+\])\s*\{[^}]*#16a34a/i.exec(css);
    expect(rule, "a scoped .cta rule with the green background").not.toBeNull();
    const token = rule![1]!.slice(1, -1);
    const signUp = buttons.find((b) => b.includes("Sign up"))!;
    expect(/<button\b[^>]*>/.exec(signUp)![0]).toContain(token);
  });

  it("keeps the .cta style out of the global scope", () => {
    expect(css).not.toMatch(/(^|[},])\s*\.cta\s*\{/);
  });
});
