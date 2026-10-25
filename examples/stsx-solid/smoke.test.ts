// Smoke test: the production build has the scoped CSS and the design tokens, and Solid's
// templates carry the scope attributes.
import { fileURLToPath } from "node:url";
import { build, type Rolldown } from "vite";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));

it("builds the scoped CSS and the templates' markers", async () => {
  const output = (await build({
    root,
    logLevel: "silent",
    build: { write: false },
  })) as Rolldown.RolldownOutput;
  const css = output.output.find((item) => item.fileName.endsWith(".css"));
  const js = output.output.find((item) => item.type === "chunk");
  const styles = css?.type === "asset" ? String(css.source) : "";
  const code = js?.type === "chunk" ? js.code : "";
  const token = /\.dot\[data-lum-([0-9a-z]{8})\]/.exec(styles)![1]!;
  expect(styles).toMatch(/--brand: ?#ea580c/);
  expect(styles).toContain("var(--brand)");
  expect(code).toMatch(new RegExp(`<span data-lum-${token} class=dot>`));
});
