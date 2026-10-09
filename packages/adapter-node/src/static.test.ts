import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BuiltAppConfig } from "lumen/build";
import { createStaticHandler } from "./static.ts";

const FILES: Record<string, string> = {
  "index.html": "<h1>home</h1>",
  "about/index.html": "<h1>about</h1>",
  "contact.html": "<h1>contact</h1>",
  "sitemap.xml": "<urlset/>",
  "assets/app-abc123.js": "console.log(1)",
  ".vite/manifest.json": "{}",
  ".well-known/security.txt": "Contact: x",
};

let dir: string;
const servers: Server[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lumen-static-"));
  for (const [name, content] of Object.entries(FILES)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
});

afterAll(() => {
  for (const server of servers) server.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Serves `dir` with the given config; misses answer 418 so tests can tell them apart. */
async function serve(config: Partial<BuiltAppConfig> = {}) {
  const statics = createStaticHandler(dir, {
    base: "/",
    trailingSlash: "ignore",
    assetsDir: "assets",
    ...config,
  });
  const server = createServer((req, res) => {
    void statics(req, res).then((served) => {
      if (!served) res.writeHead(418).end();
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return (path: string, init?: RequestInit) =>
    fetch(origin + path, { redirect: "manual", ...init });
}

describe("createStaticHandler", () => {
  it("indexes the directory when created: files written later are not served", async () => {
    const get = await serve();
    writeFileSync(join(dir, "late.txt"), "late");
    try {
      expect((await get("/late.txt")).status).toBe(418);
      expect((await (await serve())("/late.txt")).status).toBe(200);
    } finally {
      rmSync(join(dir, "late.txt"));
    }
  });

  it("serves files with their type; hashed assets are immutable, the rest revalidates", async () => {
    const get = await serve();
    const page = await get("/about/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(await page.text()).toBe("<h1>about</h1>");
    const asset = await get("/assets/app-abc123.js");
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await get("/sitemap.xml")).headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
  });

  it("answers conditional requests with 304 and HEAD without a body", async () => {
    const get = await serve();
    const first = await get("/");
    const etag = first.headers.get("etag")!;
    expect(etag).toMatch(/^W\/"/);
    expect((await get("/", { headers: { "if-none-match": etag } })).status).toBe(304);
    const head = await get("/", { method: "HEAD" });
    expect(head.headers.get("content-length")).toBe(String(FILES["index.html"]!.length));
    expect(await head.text()).toBe("");
  });

  it("leaves other methods, misses, dot files and traversal to the next handler", async () => {
    const get = await serve();
    expect((await get("/", { method: "POST" })).status).toBe(418);
    expect((await get("/missing")).status).toBe(418);
    expect((await get("/.vite/manifest.json")).status).toBe(418);
    expect((await get("/.well-known/security.txt")).status).toBe(200);
    expect((await get("/assets/..%2f..%2fetc%2fpasswd")).status).toBe(418);
    expect((await get("/%E0%A4%A")).status).toBe(418);
  });

  it("trailingSlash ignore: /about and /about/ serve about/index.html; /contact serves contact.html", async () => {
    const get = await serve();
    expect(await (await get("/about")).text()).toBe("<h1>about</h1>");
    expect(await (await get("/contact")).text()).toBe("<h1>contact</h1>");
  });

  it("trailingSlash always: redirects /about to /about/", async () => {
    const get = await serve({ trailingSlash: "always" });
    const res = await get("/about?x=1");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/about/?x=1");
    expect((await get("/contact")).status).toBe(418);
  });

  it("trailingSlash never: serves /contact from contact.html and redirects /contact/", async () => {
    const get = await serve({ trailingSlash: "never" });
    expect(await (await get("/contact")).text()).toBe("<h1>contact</h1>");
    const res = await get("/contact/");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/contact");
  });

  it("serves below the base only", async () => {
    const get = await serve({ base: "/docs/" });
    expect(await (await get("/docs")).text()).toBe("<h1>home</h1>");
    expect(await (await get("/docs/about/")).text()).toBe("<h1>about</h1>");
    expect((await get("/about/")).status).toBe(418);
  });
});
