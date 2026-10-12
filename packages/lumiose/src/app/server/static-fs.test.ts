// The static files of `dist/client` for the build's fetch handler (./static-fs.ts): the same URL
// rules as @lumiose/adapter-node, on web Requests and Responses.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BuiltAppConfig } from "./app.ts";
import { staticFiles } from "./static-fs.ts";

const FILES: Record<string, string> = {
  "index.html": "<h1>home</h1>",
  "about/index.html": "<h1>about</h1>",
  "contact.html": "<h1>contact</h1>",
  "sitemap.xml": "<urlset/>",
  "assets/app-B4x9QkZ2.js": "console.log(1)",
  "assets/logo.svg": "<svg/>",
  "assets/style.css": "a{}",
  "assets/style.css.br": "br-bytes",
  "assets/style.css.gz": "gz-bytes",
  "big.bin": "x".repeat(200_000),
  _headers: "/*\n  X-Test: 1\n",
  ".vite/manifest.json": "{}",
  ".well-known/security.txt": "Contact: x",
};

let dir: string;
/** A directory outside `dir` that a link in it points to. */
let outside: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "lumiose-static-fs-"));
  for (const [name, content] of Object.entries(FILES)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  // A linked directory, and a link back to the root (a cycle).
  outside = mkdtempSync(join(tmpdir(), "lumiose-static-fs-linked-"));
  writeFileSync(join(outside, "doc.txt"), "linked");
  symlinkSync(outside, join(dir, "linked"));
  symlinkSync(dir, join(dir, "about", "loop"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

/** Serves `dir`; misses answer 418 so tests can tell them apart. */
function serve(config: Partial<BuiltAppConfig> = {}, root: string | URL = dir) {
  const statics = staticFiles(root, {
    base: "/",
    trailingSlash: "ignore",
    assetsDir: "assets",
    ...config,
  });
  return async (path: string, init?: RequestInit) => {
    const request = new Request(`http://x.test${path}`, init);
    return (await statics(request, new URL(request.url))) ?? new Response(null, { status: 418 });
  };
}

describe("staticFiles", () => {
  it("indexes the directory on the first request: files written later are not served", async () => {
    const get = serve();
    writeFileSync(join(dir, "early.txt"), "early");
    expect(await (await get("/early.txt")).text()).toBe("early");
    writeFileSync(join(dir, "late.txt"), "late");
    try {
      expect((await get("/late.txt")).status).toBe(418);
    } finally {
      rmSync(join(dir, "early.txt"));
      rmSync(join(dir, "late.txt"));
    }
  });

  it("serves files with their type; hashed assets are immutable, the rest revalidates", async () => {
    const get = serve({}, pathToFileURL(`${dir}/`));
    const page = await get("/about/");
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(page.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(await page.text()).toBe("<h1>about</h1>");
    const asset = await get("/assets/app-B4x9QkZ2.js");
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect((await get("/assets/logo.svg")).headers.get("cache-control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    const big = await get("/big.bin");
    expect(big.headers.get("content-type")).toBe("application/octet-stream");
    expect(big.headers.get("content-length")).toBe("200000");
    expect((await big.text()).length).toBe(200_000);
  });

  it("serves the precompressed copy the client accepts, with Vary", async () => {
    const get = serve();
    const br = await get("/assets/style.css", { headers: { "accept-encoding": "gzip, br" } });
    expect(br.headers.get("content-encoding")).toBe("br");
    expect(br.headers.get("vary")).toBe("accept-encoding");
    expect(br.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(await br.text()).toBe("br-bytes");
    const gzip = await get("/assets/style.css", { headers: { "accept-encoding": "gzip" } });
    expect(gzip.headers.get("content-encoding")).toBe("gzip");
    expect(gzip.headers.get("etag")).not.toBe(br.headers.get("etag"));
    const plain = await get("/assets/style.css", { headers: { "accept-encoding": "identity" } });
    expect(plain.headers.get("content-encoding")).toBeNull();
    expect(plain.headers.get("vary")).toBe("accept-encoding");
    expect(await plain.text()).toBe("a{}");
  });

  it("does not serve _headers or a precompressed copy as files of their own", async () => {
    const get = serve();
    expect((await get("/_headers")).status).toBe(418);
    expect((await get("/assets/style.css.br")).status).toBe(418);
  });

  it("answers conditional requests with 304 and HEAD without a body", async () => {
    const get = serve();
    const first = await get("/");
    const etag = first.headers.get("etag")!;
    expect(etag).toMatch(/^W\/"/);
    expect((await get("/", { headers: { "if-none-match": etag } })).status).toBe(304);
    const since = first.headers.get("last-modified")!;
    expect((await get("/", { headers: { "if-modified-since": since } })).status).toBe(304);
    const head = await get("/", { method: "HEAD" });
    expect(head.headers.get("content-length")).toBe(String(FILES["index.html"]!.length));
    expect(await head.text()).toBe("");
  });

  it("leaves other methods, misses, dot files and traversal to the app", async () => {
    const get = serve();
    expect((await get("/", { method: "POST" })).status).toBe(418);
    expect((await get("/missing")).status).toBe(418);
    expect((await get("/.vite/manifest.json")).status).toBe(418);
    expect((await get("/.well-known/security.txt")).status).toBe(200);
    expect((await get("/assets/..%2f..%2fetc%2fpasswd")).status).toBe(418);
    expect((await get("/%E0%A4%A")).status).toBe(418);
  });

  it("follows symbolic links; a link to a directory already indexed (a cycle) is skipped", async () => {
    const get = serve();
    expect(await (await get("/linked/doc.txt")).text()).toBe("linked");
    expect((await get("/about/loop/contact.html")).status).toBe(418);
  });

  it("follows the build's trailingSlash", async () => {
    const ignore = serve();
    expect(await (await ignore("/about")).text()).toBe("<h1>about</h1>");
    expect(await (await ignore("/contact")).text()).toBe("<h1>contact</h1>");
    const always = serve({ trailingSlash: "always" });
    const slashed = await always("/about?x=1");
    expect(slashed.status).toBe(308);
    expect(slashed.headers.get("location")).toBe("/about/?x=1");
    expect((await always("/contact")).status).toBe(418);
    const never = serve({ trailingSlash: "never" });
    expect(await (await never("/contact")).text()).toBe("<h1>contact</h1>");
    const unslashed = await never("/contact/");
    expect(unslashed.status).toBe(308);
    expect(unslashed.headers.get("location")).toBe("/contact");
  });

  it("serves below the base only", async () => {
    const get = serve({ base: "/docs/" });
    expect(await (await get("/docs")).text()).toBe("<h1>home</h1>");
    expect(await (await get("/docs/contact")).text()).toBe("<h1>contact</h1>");
    expect((await get("/contact")).status).toBe(418);
  });

  it("has no files when the directory is missing", async () => {
    const get = serve({}, join(dir, "no-such-dir"));
    expect((await get("/")).status).toBe(418);
  });
});
