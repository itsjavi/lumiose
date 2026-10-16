// TASK-109: pages and layouts rendered only on the server read their own props as plain values
// (no LUM2001); spa routes and islands still get it. @lumiose/vite compiles with the route mode.
import { linkLumiose } from "./test-links.ts";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join as joinPath } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger, createServer, type ViteDevServer, normalizePath } from "vite";
import lumiose from "./index.ts";
import { scanServerRoutes } from "./server-routes.ts";

// Vite's ids use `/`, also on Windows: so do the paths in these expectations.
const join = (...parts: string[]): string => normalizePath(joinPath(...parts));

const binding = await import("@lumiose/compiler").catch(() => undefined);

const derived = (
  extra = "",
) => `${extra}export default function Page(props: { params: { slug: string } }) {
  const title = props.params.slug.toUpperCase();
  return <h1>{title}</h1>;
}
`;

const FILES: Record<string, string> = {
  "src/routes/books/[slug]/page.tsx": derived(),
  "src/routes/live/[slug]/page.tsx": derived('export const mode = "server";\n'),
  "src/routes/app/[slug]/page.tsx": derived('export const mode = "spa";\n'),
  "src/routes/layout.tsx": `export default function Layout(props: { children?: JSX.Element; title?: string }) {
  const heading = props.title?.trim();
  return <div>{heading}{props.children}</div>;
}
`,
  "src/components/Card.tsx": `export function Card(props: { name: string }) {
  const upper = props.name.toUpperCase();
  return <p>{upper}</p>;
}
`,
};

let root: string;
let server: ViteDevServer;
const warnings: string[] = [];

beforeAll(async () => {
  if (!binding) return;
  root = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-server-routes-"))));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  const logger = createLogger("silent");
  logger.warn = (message) => void warnings.push(message);
  server = await createServer({
    root,
    configFile: false,
    customLogger: logger,
    plugins: [lumiose()],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
});

afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.skipIf(!binding)("server routes", () => {
  it("lists the static and server pages and layouts, not spa routes", async () => {
    const files = await scanServerRoutes(root, {});
    expect([...files].map((file) => file.slice(root.length)).toSorted()).toEqual([
      "/src/routes/books/[slug]/page.tsx",
      "/src/routes/layout.tsx",
      "/src/routes/live/[slug]/page.tsx",
    ]);
  });

  it("reports LUM2001 for props reads only outside server-rendered route modules", async () => {
    for (const file of Object.keys(FILES)) {
      await server.environments.ssr.transformRequest(`/${file}`);
    }
    const stale = warnings.filter((w) => w.includes("LUM2001"));
    expect(stale.map((w) => /`(\w+)` is computed once/.exec(w)?.[1]).toSorted()).toEqual([
      "title",
      "upper",
    ]);
    // The spa route (and the component) are the two reported.
    expect(stale.some((w) => w.includes("app/[slug]/page.tsx"))).toBe(true);
    expect(stale.some((w) => w.includes("Card.tsx"))).toBe(true);
  });
});
