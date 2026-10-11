// Builds the Lumiose website into one static directory, as GitHub Pages serves it
// (.github/workflows/pages.yml runs the same command):
//
//   pnpm build:site [--base /lumiose/] [--out dist/site] [--skip-compiler] [--site-url <url>]
//   pnpm preview:site [--base /lumiose/] [--out dist/site] [--port 4173]
//   node scripts/site.ts redirects --out <dir> [--base /lumiose/]
//
// - apps/web (/, /docs, /showcase, /benchmarks, /playground) lands at the root of the output.
// - The example apps that need no server are built below it (TASK-215): the real apps at
//   showcase/<slug>/ (indexed), the samples with dummy content at demos/<slug>/ (every page gets
//   `<meta name="robots" content="noindex">`). Repository folders keep their names. ssr-bookshelf
//   needs a server: the website shows a screenshot and links its code instead.
// - Old URLs (examples/<folder>/…, shared publicly before TASK-215) redirect without loss: a stub at
//   each old root and the root 404.html (for deeper paths) send the browser to the new home with the
//   same rest of the path, query and hash (Dotmatrix share links carry the song in `?song=…`). A
//   meta refresh and a canonical link are the no-JS fallback. `redirects` writes only these into a
//   built apps/web, for its e2e tests.
// - sitemap.xml lists every indexable page (not 404 pages, redirect stubs or noindex pages), with
//   absolute URLs from --site-url (or LUMIOSE_SITE_URL; on GitHub Actions it defaults to
//   https://<owner>.github.io<base>). Without one, no sitemap is written.
// - Benchmarks: the fullstack results viewer with the committed results at
//   benchmarks/fullstack/, and the Lumiose js-framework-benchmark app at
//   benchmarks/js-framework-benchmark/app/ (the results page itself is apps/web's).
// - GitHub Pages answers every missing path with the root 404.html, so that page gets a script
//   that renders an example's own 404.html in place for paths below it: the SPA shell of
//   the chiptune tracker (deep links such as /showcase/chiptune-tracker/songs/3) or the journal's
//   404 page.
// - The base is the URL path the site is served below (default "/"; also read from LUMIOSE_BASE).
//   A project page on GitHub Pages lives at https://<user>.github.io/<repo>/, so its base is
//   /<repo>/. The output holds the files themselves, not a <base> folder.
// - The native compiler (@lumiose/compiler, napi) is built first, since `lumiose build` compiles with
//   it; --skip-compiler reuses an existing build. apps/web's build also builds the playground's
//   WebAssembly compiler (needs `rustup target add wasm32-unknown-unknown` and the pinned
//   wasm-bindgen-cli, see apps/web/scripts/playground-assets.ts).
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
import { EXAMPLES, MOUNTS } from "./site-mounts.ts";

const repo = fileURLToPath(new URL("..", import.meta.url));

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: process.env["LUMIOSE_BASE"] ?? "/" },
    out: { type: "string", default: "dist/site" },
    port: { type: "string", default: "4173" },
    "site-url": { type: "string", default: process.env["LUMIOSE_SITE_URL"] },
    "skip-compiler": { type: "boolean", default: false },
  },
});

/** "/", "lumiose", "/lumiose" and "/lumiose/" normalize to "/" and "/lumiose/". */
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

/** Old URL prefixes (before TASK-215) and their new homes, relative to the base. */
const MOVED = EXAMPLES.map(({ name, path }) => ({ from: `examples/${name}/`, to: path }));

/** Copies a build without the precompressed twins and host config Pages does not use. */
function copyBuild(from: string, to: string): void {
  cpSync(from, to, {
    recursive: true,
    filter: (path) => !/\.(?:br|gz)$/.test(path) && !path.endsWith("_headers"),
  });
}

function build(): void {
  if (!values["skip-compiler"]) pnpm(["build:compiler"]);
  pnpm(["--filter", "@lumiose/web", "build"], { LUMIOSE_BASE: base });
  for (const { name, path } of EXAMPLES) {
    // LUMIOSE_PAGES tells an example it is built for a static host without custom headers
    // (spa-chiptune's cross-origin isolation service worker, TASK-172).
    pnpm(["--filter", `@lumiose-examples/${name}`, "build"], {
      LUMIOSE_BASE: `${base}${path}`,
      LUMIOSE_PAGES: "1",
      // The website's root, for each demo's "Made with Lumiose" link.
      PUBLIC_LUMIOSE_SITE: base,
    });
  }
  pnpm(["--filter", "@lumiose/bench-jsfb", "build"]);

  rmSync(out, { recursive: true, force: true });
  copyBuild(join(repo, "apps/web/dist/client"), out);
  // Each mount from its package's output (scripts/site-mounts.ts).
  for (const { path, files } of MOUNTS) {
    for (const { at, from } of files) copyBuild(join(repo, from), join(out, path, at));
  }
  for (const { path, indexed } of EXAMPLES) {
    if (!indexed) {
      for (const file of htmlFiles(join(out, path))) {
        writeFileSync(file, readFileSync(file, "utf8").replace("</head>", `${NOINDEX}</head>`));
      }
    }
  }
  const viewer = join(out, "benchmarks/fullstack/index.html");
  writeFileSync(
    viewer,
    readFileSync(viewer, "utf8").replace("data-lumiose-site hidden", `href="${base}"`),
  );

  redirects();
  sitemap();
  console.log(`site: ${values.out} (base ${base})`);
}

const NOINDEX = '<meta name="robots" content="noindex">';

/** Every .html file below `dir`. */
function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * The redirect from an old URL: below an old prefix, `location.replace()` to the new home with the
 * rest of the path, the query and the hash. It runs in the old roots' stubs and in the root 404 page
 * (GitHub Pages serves that for every missing path, such as /examples/spa-dotmatrix/songs).
 */
function redirectScript(siteBase: string, moved: typeof MOVED): string {
  return `(function(){var b=${JSON.stringify(siteBase)},m=${JSON.stringify(moved)},p=location.pathname;for(var i=0;i<m.length;i++){var f=b+m[i].from;if((p+"/").indexOf(f)===0){location.replace(b+m[i].to+p.slice(f.length)+location.search+location.hash);document.write('<plaintext style="display:none">');return}}})();`;
}

/** The stub at an old root: the script, then a meta refresh and a canonical link without JS. */
function redirectStub(to: string): string {
  const target = `${base}${to}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved to ${target}</title><script>${redirectScript(base, MOVED)}</script><meta http-equiv="refresh" content="0;url=${target}">${NOINDEX}<link rel="canonical" href="${target}"></head><body><p>This page moved to <a href="${target}">${target}</a>.</p></body></html>\n`;
}

/** Writes the old roots' stubs and the redirect into the root 404 page. */
function redirects(): void {
  for (const { from, to } of MOVED) {
    mkdirSync(join(out, from), { recursive: true });
    writeFileSync(join(out, from, "index.html"), redirectStub(to));
  }
  const scopes = EXAMPLES.flatMap(({ path }) =>
    existsSync(join(out, path, "404.html")) ? [path] : [],
  );
  const notFound = join(out, "404.html");
  writeFileSync(
    notFound,
    readFileSync(notFound, "utf8").replace(
      "<head>",
      `<head><script>${redirectScript(base, MOVED)}</script>${fallback(scopes)}`,
    ),
  );
}

/** The public URL of the base, for the sitemap's absolute URLs; undefined when unknown. */
function siteUrl(): string | undefined {
  const explicit = values["site-url"];
  if (explicit) return explicit.endsWith("/") ? explicit : `${explicit}/`;
  const owner = process.env["GITHUB_ACTIONS"] ? process.env["GITHUB_REPOSITORY_OWNER"] : undefined;
  return owner ? `https://${owner.toLowerCase()}.github.io${base}` : undefined;
}

/** sitemap.xml: every indexable page (no 404 pages, no redirect stubs, no noindex pages). */
function sitemap(): void {
  const url = siteUrl();
  if (url === undefined) {
    console.log("site: no sitemap.xml (pass --site-url or set LUMIOSE_SITE_URL).");
    return;
  }
  const pages = htmlFiles(out)
    .filter((file) => !file.endsWith("404.html") && !readFileSync(file, "utf8").includes(NOINDEX))
    .map((file) =>
      file
        .slice(out.length + 1)
        .replaceAll("\\", "/")
        .replace(/(^|\/)index\.html$/, "$1"),
    )
    .toSorted();
  const entries = pages.map((page) => `  <url><loc>${url}${page}</loc></url>`).join("\n");
  writeFileSync(
    join(out, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
  );
  // Crawlers read robots.txt at the domain's root only.
  if (base === "/")
    writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${url}sitemap.xml\n`);
  console.log(`site: sitemap.xml with ${pages.length} pages`);
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
    const requested = new URL(request.url ?? "/", "http://x");
    const pathname = decodeURIComponent(requested.pathname);
    if (base !== "/" && pathname === base.slice(0, -1)) {
      response.writeHead(301, { location: base }).end();
      return;
    }
    const relative = pathname.startsWith(base) ? pathname.slice(base.length) : undefined;
    const found = relative === undefined ? undefined : file(relative);
    // Like GitHub Pages, a directory without its trailing slash redirects to it, query included.
    if (found && found !== join(out, normalize(relative!)) && !pathname.endsWith("/")) {
      response.writeHead(301, { location: `${requested.pathname}/${requested.search}` }).end();
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
else if (command === "redirects") redirects();
else throw new Error(`Unknown command ${command}: use build or preview.`);
