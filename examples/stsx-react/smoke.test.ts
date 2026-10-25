// Smoke test: the production build has the scoped CSS (class strategy), with the typed var() names,
// and the markers in the components' class names; the server renders them too, with class
// passthrough to `Button`.
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { build, createLogger, createServer, type Rolldown } from "vite";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));

it("builds the scoped CSS and the class markers", async () => {
  const output = (await build({
    root,
    logLevel: "silent",
    build: { write: false },
  })) as Rolldown.RolldownOutput;
  const css = output.output.find((item) => item.fileName.endsWith(".css"));
  const js = output.output.find((item) => item.type === "chunk");
  const styles = css?.type === "asset" ? String(css.source) : "";
  const code = js?.type === "chunk" ? js.code : "";
  const scope = /\.page\.(lum-[0-9a-z]{8})/.exec(styles)![1]!;
  expect(styles).toContain(`.increment.lum-`);
  expect(styles).toMatch(/--brand: ?#7c3aed/);
  expect(styles).toContain("var(--radius-sm)");
  expect(styles).toMatch(/@media \(width ?< ?640px\)/);
  expect(code).toContain(scope);
});

it("server-renders the markers, with class passthrough to Button", async () => {
  const server = await createServer({
    root,
    customLogger: createLogger("silent"),
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
  try {
    const { Counter } = await server.ssrLoadModule("/src/Counter.stsx");
    const html = renderToString(createElement(Counter, { label: "+1" }));
    const scope = /class="counter (lum-[0-9a-z]{8})"/.exec(html)![1]!;
    expect(html).toContain(`<button type="button" class="increment ${scope}">+1</button>`);
  } finally {
    await server.close();
  }
});
