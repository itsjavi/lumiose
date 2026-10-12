// LOCAL ONLY (never in CI): builds the sample with @lumiose/adapter-vercel and checks the Build
// Output API directory. Vercel has no local runner for `.vercel/output` (`vercel dev` runs the
// framework's dev server instead), so this script:
//
// 1. validates `config.json` and each function's `.vc-config.json` against the Build Output API v3,
// 2. copies the function directory out of the repository (no node_modules to fall back on), and
// 3. serves `.vercel/output` with a small Node.js harness that follows the routes as Vercel's router
//    does (headers of `continue` routes, `methods`, the filesystem with `overrides`, then the
//    function), calling the function as Vercel's Node.js launcher does (`handler(req, res)`) or,
//    with `--edge`, its Edge module (`default(request, context)`, in Node.js, not the Edge runtime).
//
//   pnpm --filter @lumiose-examples/ssr-deploy e2e:vercel [--edge]
import {
  createReadStream,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { cp, mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { report, runChecks } from "./checks.ts";
import { run, SAMPLE } from "./process.ts";

const edge = process.argv.includes("--edge");
const OUTPUT = join(SAMPLE, ".vercel/output");

type Route = {
  src?: string;
  methods?: string[];
  headers?: Record<string, string>;
  dest?: string;
  status?: number;
  continue?: boolean;
  handle?: string;
};
interface Config {
  version: number;
  routes: Route[];
  overrides?: Record<string, { path?: string; contentType?: string }>;
}

const HANDLES = ["filesystem", "miss", "rewrite", "hit", "error", "resource"];
const ROUTE_KEYS = ["src", "methods", "headers", "dest", "status", "continue", "handle"];

/** Throws with every problem of `.vercel/output` against the Build Output API v3. */
function validate(): { config: Config; functions: Map<string, string> } {
  const problems: string[] = [];
  const config = JSON.parse(readFileSync(join(OUTPUT, "config.json"), "utf8")) as Config;
  if (config.version !== 3) problems.push(`config.json: version ${config.version}, expected 3`);
  if (!Array.isArray(config.routes)) problems.push("config.json: routes is not an array");
  const functions = new Map<string, string>();
  for (const [index, route] of (config.routes ?? []).entries()) {
    const where = `routes[${index}]`;
    for (const key of Object.keys(route)) {
      if (!ROUTE_KEYS.includes(key)) problems.push(`${where}: unknown key ${key}`);
    }
    if (route.handle !== undefined) {
      if (!HANDLES.includes(route.handle)) problems.push(`${where}: handle ${route.handle}`);
      if (Object.keys(route).length > 1) problems.push(`${where}: a handle route has other keys`);
      continue;
    }
    if (typeof route.src !== "string") {
      problems.push(`${where}: no src`);
      continue;
    }
    try {
      new RegExp(route.src);
    } catch (error) {
      problems.push(`${where}: src is not a regular expression: ${(error as Error).message}`);
    }
    if (route.methods !== undefined && !route.methods.every((m) => /^[A-Z]+$/.test(m))) {
      problems.push(`${where}: methods`);
    }
    for (const [name, value] of Object.entries(route.headers ?? {})) {
      if (typeof value !== "string" || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) {
        problems.push(`${where}: header ${name}`);
      }
    }
    if (route.dest !== undefined) {
      if (!route.dest.startsWith("/")) problems.push(`${where}: dest ${route.dest}`);
      const func = join(OUTPUT, "functions", `${route.dest.slice(1)}.func`);
      if (existsSync(func)) functions.set(route.dest, func);
      else if (!existsSync(join(OUTPUT, "static", route.dest))) {
        problems.push(`${where}: dest ${route.dest} is neither a function nor a static file`);
      }
    }
  }
  for (const [file, override] of Object.entries(config.overrides ?? {})) {
    if (!existsSync(join(OUTPUT, "static", file))) problems.push(`overrides: no static ${file}`);
    if (override.path !== undefined && override.path.startsWith("/")) {
      problems.push(`overrides.${file}: path must not start with /`);
    }
  }
  for (const [dest, func] of functions) {
    const vc = JSON.parse(readFileSync(join(func, ".vc-config.json"), "utf8")) as Record<
      string,
      unknown
    >;
    const where = `${dest}.func/.vc-config.json`;
    if (vc.runtime === "edge") {
      if (typeof vc.entrypoint !== "string" || !existsSync(join(func, vc.entrypoint))) {
        problems.push(`${where}: entrypoint`);
      }
    } else {
      if (typeof vc.runtime !== "string" || !/^nodejs\d+\.x$/.test(vc.runtime)) {
        problems.push(`${where}: runtime ${String(vc.runtime)}`);
      }
      if (typeof vc.handler !== "string" || !existsSync(join(func, vc.handler))) {
        problems.push(`${where}: handler`);
      }
      if (vc.launcherType !== "Nodejs") problems.push(`${where}: launcherType`);
    }
    // Every file and link stays inside the function directory.
    const root = realpathSync(func);
    const walk = (dir: string): void => {
      for (const name of readdirSyncSafe(dir)) {
        const path = join(dir, name);
        const real = realpathSync(path);
        if (real !== root && !real.startsWith(root + sep)) {
          problems.push(`${dest}.func: ${relative(func, path)} leads outside the function`);
          continue;
        }
        if (lstatSync(path).isDirectory()) walk(path);
      }
    };
    walk(func);
  }
  if (problems.length > 0) throw new Error(`Invalid .vercel/output:\n  ${problems.join("\n  ")}`);
  return { config, functions };
}

function readdirSyncSafe(dir: string): string[] {
  try {
    return statSync(dir).isDirectory() ? readdirSync(dir) : [];
  } catch {
    return [];
  }
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** The static file for a path, as Vercel's filesystem check finds it. */
function staticFile(config: Config, pathname: string): string | undefined {
  const path = decodeURIComponent(pathname).replace(/^\//, "");
  for (const [file, override] of Object.entries(config.overrides ?? {})) {
    if (override.path === path) return file;
  }
  const candidates = path === "" || path.endsWith("/") ? [`${path}index.html`] : [path];
  for (const candidate of candidates) {
    const absolute = join(OUTPUT, "static", candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return undefined;
}

type NodeHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;
type EdgeHandler = (
  request: Request,
  context: { waitUntil(promise: Promise<unknown>): void },
) => Promise<Response>;

async function serve(
  config: Config,
  handlers: Map<string, NodeHandler | EdgeHandler>,
): Promise<string> {
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://harness");
      const headers: Record<string, string> = {};
      const send = (file: string, status = 200) => {
        res.writeHead(status, {
          ...headers,
          "content-type": TYPES[extname(file)] ?? "application/octet-stream",
        });
        if (req.method === "HEAD") res.end();
        else createReadStream(join(OUTPUT, "static", file)).pipe(res);
      };
      for (const route of config.routes) {
        if (route.handle === "filesystem") {
          const file =
            req.method === "GET" || req.method === "HEAD"
              ? staticFile(config, url.pathname)
              : undefined;
          if (file !== undefined) return send(file);
          continue;
        }
        if (route.handle !== undefined) continue;
        if (!new RegExp(route.src!).test(url.pathname)) continue;
        if (route.methods !== undefined && !route.methods.includes(req.method ?? "GET")) continue;
        Object.assign(headers, route.headers);
        if (route.continue) continue;
        const handler = route.dest === undefined ? undefined : handlers.get(route.dest);
        if (handler === undefined) {
          if (route.dest !== undefined) return send(route.dest.slice(1), route.status ?? 200);
          continue;
        }
        // Vercel's proxy: the public origin and the client's address in headers.
        req.headers["x-forwarded-proto"] = "http";
        req.headers["x-forwarded-host"] = req.headers.host;
        req.headers["x-real-ip"] = req.socket.remoteAddress;
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
        if (edge) {
          const request = new Request(
            new URL(url.pathname + url.search, `http://${req.headers.host}`),
            {
              method: req.method,
              headers: Object.entries(req.headers).flatMap(([name, value]) =>
                value === undefined
                  ? []
                  : [[name, Array.isArray(value) ? value.join(", ") : value]],
              ) as [string, string][],
              ...(req.method === "GET" || req.method === "HEAD"
                ? {}
                : {
                    body: (await import("node:stream")).Readable.toWeb(req) as ReadableStream,
                    duplex: "half",
                  }),
            } as RequestInit,
          );
          const response = await (handler as EdgeHandler)(request, {
            waitUntil: (promise) => void promise.catch(() => {}),
          });
          const { sendWebResponse } = await import("lumiose/node");
          return sendWebResponse(res, response);
        }
        return (handler as NodeHandler)(req, res);
      }
      res.writeHead(404).end("harness: no route");
    })().catch((error: unknown) => {
      console.error(error);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.once("exit", () => server.close());
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

await run("pnpm", [edge ? "build:vercel-edge" : "build:vercel"]);
const { config, functions } = validate();
console.log(
  `\n.vercel/output is valid (${config.routes.length} routes, ${functions.size} function).`,
);

// The function alone, outside the repository: only what the adapter put in it.
const handlers = new Map<string, NodeHandler | EdgeHandler>();
const copies: string[] = [];
for (const [dest, func] of functions) {
  const copy = await mkdtemp(join(tmpdir(), "lumiose-vercel-func-"));
  copies.push(copy);
  await cp(func, copy, { recursive: true, verbatimSymlinks: true });
  const vc = JSON.parse(readFileSync(join(copy, ".vc-config.json"), "utf8")) as {
    handler?: string;
    entrypoint?: string;
  };
  const module = (await import(pathToFileURL(join(copy, vc.handler ?? vc.entrypoint!)).href)) as {
    default: NodeHandler | EdgeHandler;
  };
  handlers.set(dest, module.default);
  const files = await readdir(copy, { recursive: true });
  console.log(`${dest}.func: ${files.length} entries, copied to ${copy}`);
}

const base = await serve(config, handlers);
let ok = false;
try {
  ok = report(
    `Vercel (${edge ? "Edge" : "Node.js"} function; Build Output API harness, not Vercel's router)`,
    await runChecks(base, {
      clientAddress: true,
      immutableAssets: true,
      waitUntil: true,
    }),
  );
} finally {
  for (const copy of copies) await rm(copy, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
