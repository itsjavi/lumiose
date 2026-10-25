// Smoke test: React Router's production build server-renders the `.stsx` components with their
// scope markers, and links each route's scoped CSS in its document.
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequestHandler, type ServerBuild } from "react-router";
import { createBuilder } from "vite";
import { afterAll, beforeAll, expect, it } from "vitest";

const root = fileURLToPath(new URL(".", import.meta.url));
let handle: (request: Request) => Promise<Response>;

beforeAll(async () => {
  rmSync(join(root, "build"), { recursive: true, force: true });
  const builder = await createBuilder({
    root,
    configFile: join(root, "vite.config.ts"),
    logLevel: "silent",
  });
  await builder.buildApp();
  const build = (await import(
    pathToFileURL(join(root, "build/server/index.js")).href
  )) as ServerBuild;
  handle = createRequestHandler(build, "production");
}, 120_000);

afterAll(() => rmSync(join(root, "build"), { recursive: true, force: true }));

async function page(path: string): Promise<string> {
  const response = await handle(new Request(`http://localhost${path}`));
  expect(response.status).toBe(200);
  return response.text();
}

const stylesheets = (html: string) =>
  [...html.matchAll(/<link rel="stylesheet" href="\/assets\/([\w-]+?)-[\w-]+\.css"/g)].map(
    (m) => m[1],
  );

it("links the scoped CSS of each route and renders the markers", async () => {
  const home = await page("/");
  expect(stylesheets(home)).toEqual(["root", "home"]);
  expect(home).toMatch(/<div data-lum-[0-9a-z]{8}="" class="counter">/);
  const about = await page("/about");
  expect(stylesheets(about)).toEqual(["root", "about"]);
  expect(about).toMatch(/<section data-lum-[0-9a-z]{8}="" class="about">/);
  const assets = readdirSync(join(root, "build/client/assets"));
  expect(assets.some((name) => /^home-.*\.css$/.test(name))).toBe(true);
});
