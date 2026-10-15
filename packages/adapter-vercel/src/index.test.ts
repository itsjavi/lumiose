// The Vercel output of real `lumiose build`s (Build Output API v3): config.json, the static files
// and the function, copied out of the project and called as Vercel's Node.js launcher calls it
// (`handler(req, res)`), or the Edge module (`default(request, context)`, in Node.js). The full
// harness is the local e2e's job (examples/ssr-deploy, `pnpm e2e:vercel`), never CI's.
import { cp } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
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
import { outputConfig, pathPattern } from "./config.ts";
import { commonAncestor, nodeRuntime } from "./function.ts";

// The build needs the native compiler binding (a dependency of lumiose, not of this package).
const binding = await import(
  pathToFileURL(createRequire(join(LUMIOSE_ROOT, "package.json")).resolve("@lumiose/compiler")).href
).catch(() => undefined);

const FILES: Record<string, string> = {
  "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
  "src/routes/about/page.stsx": "export default function About() { return <h1>About</h1>; }\n",
  "src/routes/form/page.stsx": `export const action = () => ({ ok: true });
export default function Form() { return <form method="post"><button>Go</button></form>; }
`,
  "src/routes/api/platform/route.ts": `import type { Endpoint } from "lumiose";
export const mode = "server";
export const GET: Endpoint = (ctx) =>
  Response.json({ ip: ctx.platform.clientAddress ?? null, url: ctx.url.href });
export const POST: Endpoint = async (ctx) => new Response("posted " + (await ctx.request.text()));
`,
  "public/robots.txt": "User-agent: *\n",
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

const roots: string[] = [];

/** Builds the app with `vercel(options)` into a temporary project. */
async function buildWith(options: string): Promise<string> {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-vercel-")));
  roots.push(root);
  const files = {
    ...FILES,
    "vite.config.ts": `import lumiose from "@lumiose/vite";
import { vercel } from "@lumiose/adapter-vercel";
export default { plugins: [lumiose({ adapter: vercel(${options}), headers: { "x-app": "1" } })] };
`,
  };
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  writeFileSync(join(root, "package.json"), '{ "type": "module" }\n');
  linkLumiose(root);
  symlinkSync(
    resolve(import.meta.dirname, ".."),
    join(root, "node_modules/@lumiose/adapter-vercel"),
    "junction",
  );
  await build({ root, logLevel: "silent" });
  return join(root, ".vercel/output");
}

/** A copy of the function directory outside the project: only what the adapter put in it. */
async function isolated(output: string): Promise<string> {
  const copy = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-vercel-func-")));
  roots.push(copy);
  await cp(join(output, "functions/__lumiose.func"), copy, {
    recursive: true,
    verbatimSymlinks: true,
  });
  return copy;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!binding)("@lumiose/adapter-vercel, Node.js runtime", () => {
  let output: string;
  beforeAll(async () => {
    output = await buildWith("");
  }, 120_000);

  it("copies dist/client to static/, without _headers or precompressed copies", () => {
    const files = readdirSync(join(output, "static"), { recursive: true }) as string[];
    expect(files).toContain("robots.txt");
    expect(files).toContain("index.html");
    expect(files).not.toContain("_headers");
    expect(files.some((file) => /\.(?:br|gz)$/.test(file))).toBe(false);
  });

  it("writes config.json: headers, hashed assets, form posts, the filesystem, then the function", () => {
    const config = JSON.parse(readFileSync(join(output, "config.json"), "utf8"));
    expect(config.version).toBe(3);
    const routes = config.routes as Array<Record<string, unknown>>;
    expect(routes[0]).toMatchObject({
      headers: { "x-content-type-options": "nosniff" },
      continue: true,
    });
    expect(routes[1]).toMatchObject({ headers: { "x-app": "1" }, continue: true });
    expect(routes.find((route) => route.methods !== undefined)).toEqual({
      src: "^\\/form/?$",
      methods: ["POST", "PUT", "PATCH", "DELETE"],
      dest: "/__lumiose",
    });
    const filesystem = routes.findIndex((route) => route.handle === "filesystem");
    expect(routes.slice(filesystem + 1)).toEqual([{ src: "^(?:/.*)?$", dest: "/__lumiose" }]);
    expect(config.overrides).toEqual({
      "about/index.html": { path: "about" },
      "form/index.html": { path: "form" },
    });
    const vc = JSON.parse(
      readFileSync(join(output, "functions/__lumiose.func/.vc-config.json"), "utf8"),
    );
    expect(vc).toEqual({
      runtime: nodeRuntime(),
      handler: "dist/server/vercel-handler.js",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
    });
  });

  it("runs from a copy of the function directory, as Vercel's launcher calls it", async () => {
    const func = await isolated(output);
    const vc = JSON.parse(readFileSync(join(func, ".vc-config.json"), "utf8"));
    const { default: handler } = (await import(pathToFileURL(join(func, vc.handler)).href)) as {
      default: (req: unknown, res: unknown) => Promise<void>;
    };
    const server = createServer((req, res) => {
      req.headers["x-forwarded-proto"] = "https";
      req.headers["x-forwarded-host"] = "app.example";
      req.headers["x-real-ip"] = "192.0.2.8";
      void handler(req, res);
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const res = await fetch(`${url}/api/platform`);
      expect(await res.json()).toEqual({
        ip: "192.0.2.8",
        url: "https://app.example/api/platform",
      });
      expect(res.headers.get("x-app")).toBe("1");
      const posted = await fetch(`${url}/api/platform`, { method: "POST", body: "ping" });
      expect(await posted.text()).toBe("posted ping");
      // The public origin from the forwarded headers: a same-site form post passes the check.
      const form = await fetch(`${url}/form`, {
        method: "POST",
        headers: { origin: "https://app.example" },
        body: new URLSearchParams({ a: "1" }),
      });
      expect(form.status).toBe(200);
      // Errors reach src/instrumentation.server.ts (TASK-298).
      expect((await fetch(`${url}/api/fail`)).status).toBe(500);
      expect(instrumentationLog()).toContain("endpoint /api/fail endpoint failed");
    } finally {
      server.close();
    }
  });
});

describe.skipIf(!binding)("@lumiose/adapter-vercel, Edge runtime", () => {
  let output: string;
  beforeAll(async () => {
    output = await buildWith('{ runtime: "edge" }');
  }, 120_000);

  it("bundles the function into one module that imports only what the Edge runtime has", () => {
    const func = join(output, "functions/__lumiose.func");
    expect(readdirSync(func).toSorted()).toEqual([".vc-config.json", "index.js"]);
    expect(JSON.parse(readFileSync(join(func, ".vc-config.json"), "utf8"))).toEqual({
      runtime: "edge",
      entrypoint: "index.js",
    });
    const code = readFileSync(join(func, "index.js"), "utf8");
    const imports = [...code.matchAll(/^import .* from "([^"]+)";$/gm)].map((match) => match[1]);
    expect(imports).toEqual(["node:async_hooks"]);
  });

  it("answers with the build's handler, ctx.platform from the request and context", async () => {
    const func = await isolated(output);
    const { default: handler } = (await import(pathToFileURL(join(func, "index.js")).href)) as {
      default: (request: Request, context: unknown) => Promise<Response>;
    };
    const waited: unknown[] = [];
    const res = await handler(
      new Request("https://app.example/api/platform", { headers: { "x-real-ip": "192.0.2.9" } }),
      { waitUntil: (promise: unknown) => waited.push(promise) },
    );
    expect(await res.json()).toEqual({ ip: "192.0.2.9", url: "https://app.example/api/platform" });
    // Errors and rejected waitUntil() work reach src/instrumentation.server.ts (TASK-298).
    const failed = await handler(new Request("https://app.example/api/fail"), {
      waitUntil: (promise: unknown) => waited.push(promise),
    });
    expect(failed.status).toBe(500);
    await expect(waited.at(-1)).rejects.toThrow("later failed");
    expect(instrumentationLog()).toEqual(
      expect.arrayContaining([
        "waitUntil /api/fail later failed",
        "endpoint /api/fail endpoint failed",
      ]),
    );
  });

  it("refuses an option it does not know", async () => {
    const { vercel } = await import("./index.ts");
    expect(() => vercel({ runtime: "bun" as "edge" })).toThrow(/expected "nodejs" or "edge"/);
  });
});

/** The pattern of the immutable route of config.json, for these files. */
const immutableRoute = (hashedFiles: string[], unhashedAssets: string[]) => {
  const config = outputConfig({
    config: { base: "/docs/", trailingSlash: "ignore", assetsDir: "assets" },
    hasFunction: true,
    pages: [],
    actionPaths: [],
    notFoundPage: false,
    hashedFiles,
    unhashedAssets,
  });
  const found = config.routes.find(
    (each) => "headers" in each && each.headers?.["cache-control"] !== undefined,
  ) as { src: string; headers: Record<string, string>; continue: boolean };
  expect(found.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  return new RegExp(found.src);
};

describe("config.json helpers", () => {
  it("turns header paths into route patterns below base", () => {
    expect(pathPattern("/**", "")).toBe("^(?:/[^/]+)*/?$");
    expect(pathPattern("/blog/*", "/docs")).toBe("^\\/docs/blog/[^/]+/?$");
    expect(new RegExp(pathPattern("/assets/**", "")).test("/assets/a/b.js")).toBe(true);
    expect(new RegExp(pathPattern("/blog/*", "")).test("/blog/a/b")).toBe(false);
  });

  it("drops a default header that lumiose({ headers }) removes everywhere", () => {
    const config = outputConfig({
      config: {
        base: "/",
        trailingSlash: "never",
        assetsDir: "assets",
        headers: { "referrer-policy": "" },
      },
      hasFunction: false,
      pages: ["about.html", "index.html", "404.html"],
      actionPaths: [],
      notFoundPage: true,
      hashedFiles: [],
      unhashedAssets: [],
    });
    expect(config.routes[0]).toEqual({
      src: "^(?:/[^/]+)*/?$",
      headers: { "x-content-type-options": "nosniff" },
      continue: true,
    });
    expect(config.routes.at(-1)).toEqual({ src: "^/.*$", dest: "/404.html", status: 404 });
    expect(config.overrides).toEqual({ "about.html": { path: "about" } });
  });

  it("caches exactly the files the build hashed, not the assets directory's public/ files", () => {
    const all = immutableRoute(["assets/a-Bx3_kZ9q.js"], []);
    expect(all.test("/docs/assets/a-Bx3_kZ9q.js")).toBe(true);
    expect(all.test("/docs/assets/sub/b-D-i-jZkv.css")).toBe(true);
    expect(all.test("/docs/about")).toBe(false);
    const some = immutableRoute(
      ["assets/a-Bx3_kZ9q.js", "fonts/f-D-i-jZkv.woff2"],
      ["assets/logo.svg", "assets/my icon.svg"],
    );
    expect(some.test("/docs/assets/a-Bx3_kZ9q.js")).toBe(true);
    expect(some.test("/docs/fonts/f-D-i-jZkv.woff2")).toBe(true);
    for (const path of [
      "/docs/assets/logo.svg",
      "/docs/assets/my%20icon.svg",
      "/docs/fonts/x.woff2",
    ]) {
      expect(some.test(path)).toBe(false);
    }
    // Only the exact file is left out.
    expect(some.test("/docs/assets/logo.svg.map")).toBe(true);
  });

  it("finds the common ancestor of directories", () => {
    // resolve() gives platform paths (`D:\a\b` on Windows), as the build passes them.
    expect(commonAncestor([resolve("/a/b/c"), resolve("/a/b/d/e"), resolve("/a/b")])).toBe(
      resolve("/a/b"),
    );
    expect(commonAncestor([resolve("/a/bc"), resolve("/a/b")])).toBe(resolve("/a"));
  });

  it("throws, instead of looping, when the directories share no root", () => {
    expect(() => commonAncestor(["/a/b", "a/b"])).toThrow(/share no common directory/);
  });
});

describe("@lumiose/adapter-vercel exports", () => {
  it("has the named export only (no default export)", async () => {
    expect(Object.keys(await import("./index.ts"))).toEqual(["vercel"]);
  });
});
