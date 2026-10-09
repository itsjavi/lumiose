// Builds the Lumen website into one static directory, as GitHub Pages serves it
// (.github/workflows/pages.yml runs the same command):
//
//   pnpm build:site [--base /lumen/] [--out dist/site] [--skip-compiler]
//   pnpm preview:site [--base /lumen/] [--out dist/site] [--port 4173]
//
// - apps/web (/ and /docs) lands at the root of the output, apps/playground under playground/.
// - The base is the URL path the site is served below (default "/"; also read from LUMEN_BASE).
//   A project page on GitHub Pages lives at https://<user>.github.io/<repo>/, so its base is
//   /<repo>/. The output holds the files themselves, not a <base> folder.
// - The native compiler (@lumen/compiler, napi) is built first, since `lumen build` compiles with
//   it; --skip-compiler reuses an existing build. The playground also builds the WebAssembly
//   compiler (needs `rustup target add wasm32-unknown-unknown` and the pinned wasm-bindgen-cli,
//   see apps/playground/scripts/assets.ts).
//
// `preview` serves the output below the base the way GitHub Pages does: directory index.html,
// and the root 404.html for anything missing.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repo = fileURLToPath(new URL("..", import.meta.url));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: process.env["LUMEN_BASE"] ?? "/" },
    out: { type: "string", default: "dist/site" },
    port: { type: "string", default: "4173" },
    "skip-compiler": { type: "boolean", default: false },
  },
});

/** "/", "lumen", "/lumen" and "/lumen/" normalize to "/" and "/lumen/". */
const base = `/${values.base.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
const out = resolve(repo, values.out);

function pnpm(args: string[], env: NodeJS.ProcessEnv = {}): void {
  try {
    execFileSync("pnpm", args, { cwd: repo, stdio: "inherit", env: { ...process.env, ...env } });
  } catch {
    console.error(`site: pnpm ${args.join(" ")} failed (see its output above).`);
    process.exit(1);
  }
}

function build(): void {
  if (!values["skip-compiler"]) pnpm(["build:compiler"]);
  for (const app of ["@lumen/web", "@lumen/playground"]) {
    pnpm(["--filter", app, "build"], { LUMEN_BASE: base });
  }
  rmSync(out, { recursive: true, force: true });
  cpSync(join(repo, "apps/web/dist/client"), out, { recursive: true });
  cpSync(join(repo, "apps/playground/dist/client"), join(out, "playground"), { recursive: true });
  console.log(`site: ${values.out} (base ${base})`);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

function preview(): void {
  if (!existsSync(out)) throw new Error(`${values.out} does not exist: run pnpm build:site first.`);
  const file = (path: string): string | undefined => {
    const target = join(out, normalize(path));
    if (!target.startsWith(out) || !existsSync(target)) return undefined;
    if (statSync(target).isFile()) return target;
    const index = join(target, "index.html");
    return existsSync(index) ? index : undefined;
  };
  const port = Number(values.port);
  createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
    if (base !== "/" && pathname === base.slice(0, -1)) {
      response.writeHead(301, { location: base }).end();
      return;
    }
    const relative = pathname.startsWith(base) ? pathname.slice(base.length) : undefined;
    const found = relative === undefined ? undefined : file(relative);
    // Like GitHub Pages, a directory without its trailing slash redirects to it.
    if (found && found !== join(out, normalize(relative!)) && !pathname.endsWith("/")) {
      response.writeHead(301, { location: `${pathname}/` }).end();
      return;
    }
    const path = found ?? join(out, "404.html");
    response.writeHead(found ? 200 : 404, {
      "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    });
    response.end(readFileSync(path));
  }).listen(port, () => console.log(`site: http://localhost:${port}${base}`));
}

const command = positionals[0] ?? "build";
if (command === "build") build();
else if (command === "preview") preview();
else throw new Error(`Unknown command ${command}: use build or preview.`);
