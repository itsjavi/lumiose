// The Cloudflare output of a real `lumiose build`: the Worker (called here with Workers'
// arguments), the assets, and a server build without its static file layer. The Worker in
// workerd is the local e2e's job (examples/ssr-deploy, `pnpm e2e:cloudflare`), never CI's.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "@lumiose/vite/build";
import { LUMIOSE_ROOT, linkLumiose } from "@lumiose/vite/internal/test-links.ts";
import { assetsCacheRules, assetsIgnore, wranglerConfig } from "./output.ts";

// The build needs the native compiler binding (a dependency of lumiose, not of this package).
const binding = await import(
  pathToFileURL(createRequire(join(LUMIOSE_ROOT, "package.json")).resolve("@lumiose/compiler")).href
).catch(() => undefined);

const FILES: Record<string, string> = {
  "vite.config.ts": `import lumiose from "@lumiose/vite";
import { cloudflare } from "@lumiose/adapter-cloudflare";
export default { plugins: [lumiose({ adapter: cloudflare(), headers: { "x-app": "1" } })] };
`,
  "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
  "src/routes/form/page.stsx": `export const action = () => ({ ok: true });
export default function Form() { return <form method="post"><button>Go</button></form>; }
`,
  "src/routes/api/platform/route.ts": `import type { Endpoint } from "lumiose";
export const mode = "server";
export const GET: Endpoint = (ctx) => {
  ctx.platform.waitUntil(Promise.resolve("later"));
  return Response.json({ env: ctx.platform.env, ip: ctx.platform.clientAddress ?? null });
};
`,
  "public/robots.txt": "User-agent: *\n",
  "public/assets/logo.svg": "<svg/>",
  "src/instrumentation.server.ts": `import type { RequestErrorInfo } from "lumiose";
const log: string[] = ((globalThis as any).lumioseInstrumentationLog ??= []);
export function register() { log.push("register"); }
export function onRequestError(error: unknown, info: RequestErrorInfo) {
  log.push(\`\${info.phase} \${info.route} \${(error as Error).message}\`);
}
`,
  "src/routes/api/fail/route.ts": `import type { Endpoint } from "lumiose";
export const mode = "server";
export const GET: Endpoint = (ctx) => {
  ctx.platform.waitUntil(Promise.reject(new Error("later failed")));
  throw new Error("endpoint failed");
};
`,
};

/** What `src/instrumentation.server.ts` of the fixture logged (TASK-298). */
const instrumentationLog = (): string[] =>
  ((globalThis as { lumioseInstrumentationLog?: string[] }).lumioseInstrumentationLog ??= []);

let root: string;

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-cloudflare-")));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  linkLumiose(root);
  symlinkSync(
    resolve(import.meta.dirname, ".."),
    join(root, "node_modules/@lumiose/adapter-cloudflare"),
    "junction",
  );
  await build({ root, logLevel: "silent" });
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

const cacheBuild = (hashedFiles: string[], unhashedAssets: string[]) => ({
  config: { base: "/docs/", trailingSlash: "ignore" as const, assetsDir: "assets" },
  hashedFiles,
  unhashedAssets,
});
const YEAR = "cache-control: public, max-age=31536000, immutable";

describe("assetsCacheRules", () => {
  it("caches the assets directory, detaches its public/ files, and adds hashed files outside it", () => {
    expect(assetsCacheRules(cacheBuild(["assets/a-Bx3_kZ9q.js"], []))).toBe(
      `/docs/assets/*\n  ${YEAR}\n`,
    );
    expect(
      assetsCacheRules(
        cacheBuild(["assets/a-Bx3_kZ9q.js", "fonts/f-D-i-jZkv.woff2"], ["assets/logo.svg"]),
      ),
    ).toBe(
      `/docs/assets/*\n  ${YEAR}\n/docs/assets/logo.svg\n  ! cache-control\n/docs/fonts/f-D-i-jZkv.woff2\n  ${YEAR}\n`,
    );
  });
});

describe.skipIf(!binding)("@lumiose/adapter-cloudflare", () => {
  it("writes the Worker next to dist/client and dist/server", () => {
    const worker = readFileSync(join(root, "dist/_worker.js"), "utf8");
    expect(worker).toContain('import handler from "./server/entry.js";');
    expect(worker).toContain("fetch(request, env, ctx)");
  });

  it("leaves dist/client to Cloudflare: no precompressed copies, no static layer in the server", () => {
    const files = readdirSync(join(root, "dist/client"), { recursive: true }) as string[];
    expect(files.some((file) => /\.(?:br|gz)$/.test(file))).toBe(false);
    const server = readdirSync(join(root, "dist/server"), { recursive: true }) as string[];
    for (const file of server.filter((name) => name.endsWith(".js"))) {
      expect(readFileSync(join(root, "dist/server", file), "utf8")).not.toMatch(/node:fs/);
    }
  });

  it("adds a year of caching for the files the build hashed to _headers, not public/ ones", () => {
    const headers = readFileSync(join(root, "dist/client/_headers"), "utf8");
    expect(headers).toContain("/*\n  x-content-type-options: nosniff\n");
    expect(headers).toContain("  x-app: 1\n");
    expect(
      headers.endsWith(
        "/assets/*\n  cache-control: public, max-age=31536000, immutable\n/assets/logo.svg\n  ! cache-control\n",
      ),
    ).toBe(true);
  });

  it("leaves prerendered pages with form actions out of the assets", () => {
    expect(existsSync(join(root, "dist/client/form/index.html"))).toBe(true);
    expect(readFileSync(join(root, "dist/client/.assetsignore"), "utf8")).toBe(
      "/form/index.html\n",
    );
    expect(assetsIgnore([{ path: "/", file: "index.html", kind: "page" }])).toBe("");
  });

  it("passes Workers' bindings, waitUntil and CF-Connecting-IP as ctx.platform", async () => {
    const worker = (await import(pathToFileURL(join(root, "dist/_worker.js")).href)) as {
      default: { fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> };
    };
    const waited: unknown[] = [];
    const ctx = {
      waitUntil(this: unknown, promise: Promise<unknown>) {
        expect(this).toBe(ctx);
        waited.push(promise);
      },
    };
    const res = await worker.default.fetch(
      new Request("https://app.example/api/platform", {
        headers: { "cf-connecting-ip": "203.0.113.9" },
      }),
      { KV: "binding" },
      ctx,
    );
    expect(await res.json()).toEqual({ env: { KV: "binding" }, ip: "203.0.113.9" });
    expect(res.headers.get("x-app")).toBe("1");
    expect(waited).toHaveLength(1);
    // A form post to the prerendered page reaches its action.
    const posted = await worker.default.fetch(
      new Request("https://app.example/form", {
        method: "POST",
        headers: { origin: "https://app.example" },
        body: new URLSearchParams({ a: "1" }),
      }),
      {},
      ctx,
    );
    expect(posted.status).toBe(200);
  });

  it("reports errors and rejected waitUntil() work to src/instrumentation.server.ts (TASK-298)", async () => {
    const worker = (await import(pathToFileURL(join(root, "dist/_worker.js")).href)) as {
      default: { fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> };
    };
    const waited: Array<Promise<unknown>> = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void waited.push(promise) };
    const res = await worker.default.fetch(new Request("https://app.example/api/fail"), {}, ctx);
    expect(res.status).toBe(500);
    // Workers still see the rejection.
    await expect(waited[0]).rejects.toThrow("later failed");
    expect(instrumentationLog()).toEqual([
      "register",
      "waitUntil /api/fail later failed",
      "endpoint /api/fail endpoint failed",
    ]);
  });

  it("suggests a wrangler config for the build", () => {
    const config = wranglerConfig({
      root,
      outDir: join(root, "dist"),
      clientDir: join(root, "dist/client"),
      serverEntry: join(root, "dist/server/entry.js"),
      config: { base: "/", trailingSlash: "never", assetsDir: "assets" },
    });
    expect(JSON.parse(config)).toMatchObject({
      main: "dist/_worker.js",
      compatibility_flags: ["nodejs_compat"],
      assets: { directory: "dist/client", html_handling: "drop-trailing-slash" },
    });
  });
});

describe.skipIf(!binding)("@lumiose/adapter-cloudflare, a fully prerendered site", () => {
  it("writes no Worker: Cloudflare serves the assets alone", async () => {
    const site = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-cloudflare-static-")));
    try {
      for (const [name, code] of Object.entries({
        "vite.config.ts": FILES["vite.config.ts"]!,
        "src/routes/page.stsx": FILES["src/routes/page.stsx"]!,
      })) {
        mkdirSync(dirname(join(site, name)), { recursive: true });
        writeFileSync(join(site, name), code);
      }
      linkLumiose(site);
      symlinkSync(
        resolve(import.meta.dirname, ".."),
        join(site, "node_modules/@lumiose/adapter-cloudflare"),
        "junction",
      );
      const result = await build({ root: site, logLevel: "silent" });
      expect(result.serverEntry).toBeUndefined();
      expect(existsSync(join(site, "dist/_worker.js"))).toBe(false);
      expect(readdirSync(join(site, "dist/client")).toSorted()).toEqual([
        "404.html",
        "_headers",
        "index.html",
      ]);
    } finally {
      rmSync(site, { recursive: true, force: true });
    }
  });
});

describe("@lumiose/adapter-cloudflare exports", () => {
  it("has the named export only (no default export)", async () => {
    expect(Object.keys(await import("./index.ts"))).toEqual(["cloudflare"]);
  });
});
