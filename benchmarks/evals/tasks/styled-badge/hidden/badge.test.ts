import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildCss, type Dev, source, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const badges = (html: string) =>
  [...html.matchAll(/<span\b[^>]*class="?([^">]*\bbadge\b[^">]*)"?[^>]*>([\s\S]*?)<\/span>/g)].map(
    (m) => ({
      classes: m[1]!.split(/\s+/).filter(Boolean).toSorted(),
      text: text(m[2]!),
    }),
  );

describe("Badge", () => {
  it("renders three badges on the home page", async () => {
    const html = await (await dev.get("/")).text();
    const found = badges(html);
    expect(found).toContainEqual({ classes: ["badge", "badge-info"], text: "Info" });
    expect(found).toContainEqual({ classes: ["badge", "badge-warning"], text: "Careful" });
    expect(found).toContainEqual({ classes: ["badge", "badge-danger"], text: "Broken" });
  });

  it("is exported from src/components/Badge.stsx and reads the tokens", () => {
    const badge = source("src/components/Badge.stsx");
    expect(badge).toMatch(/export\s+(function|const)\s+Badge\b/);
    expect(badge).toMatch(/tokens/);
    for (const hex of ["#2563eb", "#d97706", "#dc2626"])
      expect(badge.toLowerCase()).not.toContain(hex);
    expect(badge).toMatch(/\$colors\.|\$tokens\.colors\.|\$radius|\$tokens\.radius/);
  });

  it("builds scoped CSS with the token colors", () => {
    const css = buildCss().toLowerCase();
    for (const hex of ["#2563eb", "#d97706", "#dc2626"]) expect(css).toContain(hex);
    expect(css).toMatch(/\.badge-warning\[data-lum-[a-z0-9]+\]/);
    expect(css).toContain("999px");
  });
});
