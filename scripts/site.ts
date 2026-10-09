// Builds the Lumen website into one static directory, as GitHub Pages serves it
// (.github/workflows/pages.yml runs the same command):
//
//   pnpm build:site [--base /lumen/] [--out dist/site] [--skip-compiler]
//   pnpm preview:site [--base /lumen/] [--out dist/site] [--port 4173]
//
// - apps/web (/, /docs, /examples, /benchmarks) lands at the root of the output, apps/playground
//   under playground/.
// - The examples that need no server are built below examples/<name>/ (TASK-163). ssr-bookshelf
//   needs a server: the website shows a screenshot and links its code instead.
// - Benchmarks: the fullstack results viewer with the committed results at
//   benchmarks/fullstack/, and the Lumen js-framework-benchmark app at
//   benchmarks/js-framework-benchmark/app/ (the results page itself is apps/web's).
// - GitHub Pages answers every missing path with the root 404.html, so that page gets a script
//   that renders an example's own 404.html in place for paths below it: the SPA shell of
//   spa-chiptune (deep links such as /examples/spa-chiptune/songs/3) or the journal's 404 page.
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
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

interface Example {
  name: string;
  /** The built static files, relative to the example. */
  dist: string;
}

/** The examples published below examples/<name>/: static output, no server. */
const EXAMPLES: Example[] = [
  { name: "spa-chiptune", dist: "dist/client" },
  { name: "ssg-travel-journal", dist: "dist/client" },
  { name: "vite-counter", dist: "dist" },
  { name: "spa-dotmatrix", dist: "dist/client" },
];

/** Copies a build without the precompressed twins and host config Pages does not use. */
function copyBuild(from: string, to: string): void {
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/\.(?:br|gz)$/.test(path) && !path.endsWith("_headers"),
  });
}

function build(): void {
  if (!values["skip-compiler"]) pnpm(["build:compiler"]);
  for (const app of ["@lumen/web", "@lumen/playground"]) {
    pnpm(["--filter", app, "build"], { LUMEN_BASE: base });
  }
  for (const { name } of EXAMPLES) {
    // LUMEN_PAGES tells an example it is built for a static host without custom headers
    // (spa-chiptune's cross-origin isolation service worker, TASK-172).
    pnpm(["--filter", `@lumen-examples/${name}`, "build"], {
      LUMEN_BASE: `${base}examples/${name}/`,
      LUMEN_PAGES: "1",
    });
  }
  pnpm(["--filter", "@lumen/bench-jsfb", "build"]);

  rmSync(out, { recursive: true, force: true });
  copyBuild(join(repo, "apps/web/dist/client"), out);
  copyBuild(join(repo, "apps/playground/dist/client"), join(out, "playground"));
  for (const { name, dist } of EXAMPLES) {
    copyBuild(join(repo, "examples", name, dist), join(out, "examples", name));
  }
  const fullstack = join(repo, "benchmarks/fullstack");
  copyBuild(join(fullstack, "viewer"), join(out, "benchmarks/fullstack"));
  mkdirSync(join(out, "benchmarks/fullstack/results"), { recursive: true });
  for (const file of readdirSync(join(fullstack, "results"))) {
    if (file.endsWith(".json")) {
      cpSync(join(fullstack, "results", file), join(out, "benchmarks/fullstack/results", file));
    }
  }
  const jsfb = join(repo, "benchmarks/js-framework-benchmark");
  const app = join(out, "benchmarks/js-framework-benchmark/app");
  copyBuild(join(jsfb, "demo"), app);
  cpSync(join(jsfb, "dist/main.js"), join(app, "main.js"));

  const scopes = EXAMPLES.flatMap(({ name }) =>
    existsSync(join(out, "examples", name, "404.html")) ? [`examples/${name}/`] : [],
  );
  writeFileSync(
    join(out, "404.html"),
    readFileSync(join(out, "404.html"), "utf8").replace("<head>", `<head>${fallback(scopes)}`),
  );
  console.log(`site: ${values.out} (base ${base})`);
}

/**
 * The root 404 page's script: below an example with its own 404.html, it turns the rest of this
 * page into hidden text (a `<plaintext>` element, so none of its scripts run) and renders that
 * one in place, so the example's router (or its own 404 page) handles the URL.
 */
function fallback(scopes: string[]): string {
  const script = `(function(){var b=${JSON.stringify(base)},s=${JSON.stringify(scopes)},p=location.pathname;for(var i=0;i<s.length;i++){if(p.indexOf(b+s[i])===0){document.write('<plaintext style="display:none">');fetch(b+s[i]+"404.html").then(function(r){return r.text()}).then(function(h){document.open();document.write(h);document.close()});return}}})();`;
  return `<script>${script}</script>`;
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
