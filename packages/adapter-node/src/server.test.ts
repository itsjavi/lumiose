// The adapter on a real `lumen build` output: statics first, then the app's fetch handler.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "lumen/build";
import { createServer, type LumenServer } from "./server.ts";

const lumenRoot = resolve(import.meta.dirname, "../../lumen");
// The build needs the native compiler binding (a dependency of lumen, not of this package).
const binding = await import(
  pathToFileURL(createRequire(join(lumenRoot, "package.json")).resolve("@lumen/compiler")).href
).catch(() => undefined);

const FILES: Record<string, string> = {
  "public/favicon.svg": "<svg/>",
  "src/routes/index.stsx": `import { Counter } from "../components/Counter.stsx";
export default function Home() { return <main><h1>Home</h1><Counter client:load start={1} /></main>; }
`,
  "src/components/Counter.stsx": `import { signal } from "lumen";
export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return <button onClick={() => count.update((n) => n + 1)}>{count()}</button>;
}
`,
  "src/routes/contact.stsx": `import { actionData, type Action } from "lumen";
// A static page with a form action: GET is prerendered, POST reaches the server.
export const action: Action = async (ctx) => ({ name: String((await ctx.formData()).get("name")) });
export default function Contact() {
  const data = actionData<{ name: string }>();
  return <p class="result">{data === undefined ? "form" : \`thanks \${data.name}\`}</p>;
}
`,
  "src/routes/account.stsx": `import { cookies } from "lumen";
export const mode = "server";
export default function Account() { return <p>user {cookies().get("user") ?? "anonymous"}</p>; }
`,
  "src/routes/embed.stsx": `import { response } from "lumen";
export const mode = "server";
export default function Embed() {
  response().setHeader("cross-origin-embedder-policy", "credentialless");
  return <p>embed</p>;
}
`,
  "src/routes/api/time.ts": `export const mode = "server";
export const GET = () => Response.json({ ok: true });
`,
  "src/routes/_404.stsx": "export default function NotFound() { return <h1>Not here</h1>; }\n",
};

let root: string;
let server: LumenServer;

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-adapter-")));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
  await build({ root, logLevel: "silent" });
  server = await createServer({ dir: join(root, "dist"), port: 0, host: "127.0.0.1" });
});

afterAll(async () => {
  await server?.close();
  if (root) rmSync(root, { recursive: true, force: true });
});

const get = (path: string, init?: RequestInit) =>
  fetch(new URL(path.slice(1), server.url), { redirect: "manual", ...init });

describe.skipIf(!binding)("@lumen/adapter-node", () => {
  it("listens on a URL with the app's base", () => {
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it("serves prerendered pages and public files from dist/client", async () => {
    const home = await get("/");
    expect(home.status).toBe(200);
    expect(home.headers.get("etag")).not.toBeNull();
    expect(home.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    const html = await home.text();
    expect(html).toContain("<h1>Home</h1>");
    expect(await (await get("/favicon.svg")).text()).toBe("<svg/>");

    const island = /<link rel="modulepreload" href="(\/assets\/[^"]+\.js)">/.exec(html)![1]!;
    const chunk = await get(island);
    expect(chunk.status).toBe(200);
    expect(chunk.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("falls back to the handler for server routes, endpoints and unknown paths", async () => {
    const account = await get("/account", { headers: { cookie: "user=ada" } });
    expect(await account.text()).toContain("<p>user ada</p>");
    expect(await (await get("/api/time")).json()).toEqual({ ok: true });
    const missing = await get("/missing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("<h1>Not here</h1>");
  });

  it("adds configured headers to every response; a response's own headers win", async () => {
    const isolated = await createServer({
      dir: join(root, "dist"),
      port: 0,
      host: "127.0.0.1",
      headers: {
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
        "cache-control": "no-store",
      },
    });
    try {
      const at = (path: string) => fetch(new URL(path.slice(1), isolated.url));
      // Static files (a page, a public file), a server page, an endpoint, the 404 page.
      for (const path of ["/", "/favicon.svg", "/account", "/api/time", "/missing"]) {
        const response = await at(path);
        expect(response.headers.get("cross-origin-opener-policy"), path).toBe("same-origin");
        expect(response.headers.get("cross-origin-embedder-policy"), path).toBe("require-corp");
      }
      expect((await at("/")).headers.get("cache-control")).toBe(
        "public, max-age=0, must-revalidate",
      );
      expect((await at("/account")).headers.get("cache-control")).toBe("no-store");
      expect((await at("/embed")).headers.get("cross-origin-embedder-policy")).toBe(
        "credentialless",
      );
    } finally {
      await isolated.close();
    }
  });

  it("sends the build's lumen({ headers }) by path; a response's own headers win (TASK-125)", async () => {
    const app = realpathSync(mkdtempSync(join(tmpdir(), "lumen-adapter-headers-")));
    const files: Record<string, string> = {
      "src/routes/index.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
      "src/routes/embed.stsx": FILES["src/routes/embed.stsx"]!,
      "vite.config.ts": `import lumen from "lumen/vite";
export default {
  plugins: [
    lumen({
      headers: [
        { path: "/**", headers: { "cross-origin-embedder-policy": "require-corp" } },
        { path: "/embed", headers: { "x-embed": "1" } },
      ],
    }),
  ],
};
`,
    };
    for (const [name, code] of Object.entries(files)) {
      mkdirSync(dirname(join(app, name)), { recursive: true });
      writeFileSync(join(app, name), code);
    }
    mkdirSync(join(app, "node_modules"));
    symlinkSync(lumenRoot, join(app, "node_modules/lumen"), "dir");
    await build({ root: app, logLevel: "silent" });
    const configured = await createServer({ dir: join(app, "dist"), port: 0, host: "127.0.0.1" });
    try {
      const at = (path: string) => fetch(new URL(path.slice(1), configured.url));
      const home = await at("/");
      expect(home.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
      expect(home.headers.get("x-embed")).toBeNull();
      const embed = await at("/embed");
      expect(embed.headers.get("x-embed")).toBe("1");
      expect(embed.headers.get("cross-origin-embedder-policy")).toBe("credentialless");
    } finally {
      await configured.close();
      rmSync(app, { recursive: true, force: true });
    }
  });

  it("routes form posts to a prerendered page to its action on the server", async () => {
    expect(await (await get("/contact")).text()).toContain("<p class=result>form</p>");
    const posted = await get("/contact", {
      method: "POST",
      body: new URLSearchParams({ name: "Ada" }),
      headers: { origin: new URL(server.url).origin },
    });
    expect(posted.status).toBe(200);
    expect(await posted.text()).toContain("<p class=result>thanks Ada</p>");
    const crossSite = await get("/contact", {
      method: "POST",
      body: new URLSearchParams({ name: "Eve" }),
      headers: { origin: "https://evil.test" },
    });
    expect(crossSite.status).toBe(403);
  });
});
