// The Netlify output of a real `lumiose build`: the functions (called here with Netlify's
// arguments) and the site. `netlify serve` is the local e2e's job (examples/ssr-deploy,
// `pnpm e2e:netlify`), never CI's.
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
import { actionsFunctionCode, assetsCacheRules } from "./output.ts";

// The build needs the native compiler binding (a dependency of lumiose, not of this package).
const binding = await import(
  pathToFileURL(createRequire(join(LUMIOSE_ROOT, "package.json")).resolve("@lumiose/compiler")).href
).catch(() => undefined);

const FILES: Record<string, string> = {
  "vite.config.ts": `import lumiose from "@lumiose/vite";
import { netlify } from "@lumiose/adapter-netlify";
export default { plugins: [lumiose({ adapter: netlify(), headers: { "x-app": "1" } })] };
`,
  "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
  "src/routes/form/page.stsx": `export const action = () => ({ ok: true });
export default function Form() { return <form method="post"><button>Go</button></form>; }
`,
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
  "src/routes/api/platform/route.ts": `import type { Endpoint } from "lumiose";
export const mode = "server";
export const GET: Endpoint = (ctx) => {
  ctx.platform.waitUntil(Promise.resolve("later"));
  return Response.json({ env: ctx.platform.env, ip: ctx.platform.clientAddress ?? null });
};
`,
  "public/robots.txt": "User-agent: *\n",
};

/** What `src/instrumentation.server.ts` of the fixture logged (TASK-298). */
const instrumentationLog = (): string[] =>
  ((globalThis as { lumioseInstrumentationLog?: string[] }).lumioseInstrumentationLog ??= []);

let root: string;

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-netlify-")));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  linkLumiose(root);
  symlinkSync(
    resolve(import.meta.dirname, ".."),
    join(root, "node_modules/@lumiose/adapter-netlify"),
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
  it("caches the assets directory when the build hashed all its files, else each hashed file", () => {
    expect(
      assetsCacheRules(cacheBuild(["assets/a-Bx3_kZ9q.js", "fonts/f-D-i-jZkv.woff2"], [])),
    ).toBe(`/docs/assets/*\n  ${YEAR}\n/docs/fonts/f-D-i-jZkv.woff2\n  ${YEAR}\n`);
    expect(
      assetsCacheRules(
        cacheBuild(["assets/a-Bx3_kZ9q.js", "assets/b-D-i-jZkv.css"], ["assets/logo.svg"]),
      ),
    ).toBe(`/docs/assets/a-Bx3_kZ9q.js\n  ${YEAR}\n/docs/assets/b-D-i-jZkv.css\n  ${YEAR}\n`);
  });
});

describe.skipIf(!binding)("@lumiose/adapter-netlify", () => {
  const functions = () => join(root, ".netlify/v1/functions");

  it("writes the server function for every path, static files first", () => {
    const code = readFileSync(join(functions(), "lumiose-server.mjs"), "utf8");
    expect(code).toContain('import handler from "../../../dist/server/entry.js";');
    expect(code).toContain('"path": [\n    "/*"\n  ]');
    expect(code).toContain('"preferStatic": true');
  });

  it("writes a function for the form posts to prerendered pages with actions", () => {
    const code = readFileSync(join(functions(), "lumiose-actions.mjs"), "utf8");
    expect(code).toContain('"method": [\n    "POST",');
    expect(code).not.toContain("preferStatic");
    expect(actionsFunctionCode("/f", "/d/server/entry.js", ["/docs/form", "/docs/"])).toContain(
      JSON.stringify(["/docs/form", "/docs/form/", "/docs/", "/docs"], null, 2).replaceAll(
        "\n",
        "\n  ",
      ),
    );
  });

  it("leaves dist/client to Netlify: no precompressed copies, assets cached for a year", () => {
    const files = readdirSync(join(root, "dist/client"), { recursive: true }) as string[];
    expect(files.some((file) => /\.(?:br|gz)$/.test(file))).toBe(false);
    expect(existsSync(join(root, "dist/client/form/index.html"))).toBe(true);
    const headers = readFileSync(join(root, "dist/client/_headers"), "utf8");
    expect(headers).toContain("  x-app: 1\n");
    expect(
      headers.endsWith("/assets/*\n  cache-control: public, max-age=31536000, immutable\n"),
    ).toBe(true);
  });

  it("passes Netlify's context as ctx.platform", async () => {
    const fn = (await import(pathToFileURL(join(functions(), "lumiose-server.mjs")).href)) as {
      default: (request: Request, context: unknown) => Promise<Response>;
    };
    const waited: unknown[] = [];
    const context = {
      ip: "198.51.100.4",
      waitUntil(this: unknown, promise: Promise<unknown>) {
        expect(this).toBe(context);
        waited.push(promise);
      },
    };
    const res = await fn.default(new Request("https://app.example/api/platform"), context);
    expect(await res.json()).toEqual({ env: {}, ip: "198.51.100.4" });
    expect(res.headers.get("x-app")).toBe("1");
    expect(waited).toHaveLength(1);
  });
});

describe.skipIf(!binding)("@lumiose/adapter-netlify instrumentation", () => {
  it("reports errors and rejected waitUntil() work to src/instrumentation.server.ts (TASK-298)", async () => {
    const functions = join(root, ".netlify/v1/functions");
    const fn = (await import(pathToFileURL(join(functions, "lumiose-server.mjs")).href)) as {
      default: (request: Request, context: unknown) => Promise<Response>;
    };
    const waited: Array<Promise<unknown>> = [];
    const context = { waitUntil: (promise: Promise<unknown>) => void waited.push(promise) };
    const res = await fn.default(new Request("https://app.example/api/fail"), context);
    expect(res.status).toBe(500);
    await expect(waited[0]).rejects.toThrow("later failed");
    expect(instrumentationLog()).toEqual(
      expect.arrayContaining([
        "register",
        "waitUntil /api/fail later failed",
        "endpoint /api/fail endpoint failed",
      ]),
    );
  });
});

describe("@lumiose/adapter-netlify exports", () => {
  it("has the named export only (no default export)", async () => {
    expect(Object.keys(await import("./index.ts"))).toEqual(["netlify"]);
  });
});
