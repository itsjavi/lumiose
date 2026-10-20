// Dev only (TASK-239): the apps scripts/site.ts mounts below the site (the showcase apps, the demos
// and the benchmark UIs) are separate builds, so `lumiose dev` serves them from their built output
// instead of answering 404. For each mount it takes the site build (apps/web/dist/site/<mount>) when that was
// built for this base, else the package's own output (scripts/site-mounts.ts). Missing paths get the
// app's own 404.html (the SPA shell of the chiptune tracker, for its deep links), as on GitHub Pages.
// An app that is not built answers with a page naming the command that builds it.
import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { MOUNTS, type Mount } from "../../../scripts/site-mounts.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
};

/** Where a mount's files come from: URL paths below the mount, mapped to absolute paths. */
type Layout = { at: string; dir: string }[];

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

/**
 * Whether a build serves from `prefix` (base + mount): every absolute script and stylesheet URL of
 * its index.html is below it. Builds with relative URLs (the benchmark UIs) work under any prefix.
 */
function builtFor(index: string, prefix: string): boolean {
  const html = readFileSync(index, "utf8");
  const urls = html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="(\/(?!\/)[^"]*)"/g);
  return [...urls].every(([, url]) => url!.startsWith(prefix));
}

/** The site build's copy, or the package's own output; undefined (with why) when neither serves. */
function findLayout(mount: Mount, prefix: string): { layout?: Layout; stale?: string } {
  // Without a trailing separator (join keeps the mount path's), for the containment check.
  const site = join(repo, "apps/web/dist/site", mount.path, ".");
  const candidates: Layout[] = [
    [{ at: "", dir: site }],
    mount.files.map(({ at, from }) => ({ at, dir: join(repo, from) })),
  ];
  let stale: string | undefined;
  for (const candidate of candidates) {
    if (!candidate.every(({ dir }) => existsSync(dir))) continue;
    const index = join(candidate[0]!.dir, "index.html");
    if (!isFile(index)) continue;
    if (builtFor(index, prefix)) return { layout: candidate };
    stale ??= candidate[0]!.dir.slice(repo.length);
  }
  return { stale };
}

/** The file for `rest` (the URL path below the mount), a directory to redirect to, or nothing. */
function resolve(layout: Layout, rest: string): { file?: string; slash?: true } {
  // Longest `at` first, so `results/` wins over the root.
  for (const { at, dir } of layout.toSorted((a, b) => b.at.length - a.at.length)) {
    if (at !== "" && !at.endsWith("/")) {
      if (rest === at) return { file: dir };
      continue;
    }
    if (!rest.startsWith(at)) continue;
    const path = normalize(join(dir, rest.slice(at.length)));
    if (path !== dir && !path.startsWith(dir + sep)) return {};
    if (!rest.endsWith("/") && isFile(path)) return { file: path };
    const index = join(path, "index.html");
    if (isFile(index)) return rest.endsWith("/") || rest === "" ? { file: index } : { slash: true };
    // Another layer may hold it (the root of a mount holds everything but `results/`).
    if (at === "") return {};
  }
  return {};
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The dev page for a mount that is not built: what it is and the command that builds it. */
function notBuilt(mount: Mount, base: string, stale: string | undefined): string {
  const siteBuild = base === "/" ? "pnpm build:site" : `pnpm build:site --base ${base}`;
  const commands = [
    `<li><code>${siteBuild}</code> builds the whole site, this app included, into <code>apps/web/dist/site</code>.</li>`,
    mount.build && `<li><code>${escape(mount.build)}</code> builds only this app.</li>`,
    mount.demo &&
      `<li><code>pnpm demo ${escape(mount.demo)}</code> runs it on its own dev server instead.</li>`,
  ].filter(Boolean);
  const why = stale
    ? `<p>The build in <code>${escape(stale)}</code> was made for another base path, so its assets would not load below <code>${escape(base)}</code>.</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Not built: ${escape(mount.title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color-scheme:light dark}code{font-size:.9em}</style></head><body><h1>${escape(mount.title)} is not built</h1><p>This dev server serves <code>${escape(base + mount.path)}</code> from a separate build, and there is none for this base path yet. Run one of these from the repository root, then reload:</p><ul>${commands.join("")}</ul>${why}<p>This page only exists in development.</p></body></html>\n`;
}

function send(response: ServerResponse, status: number, file: string): void {
  response.writeHead(status, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
}

/** Serves the mounts of scripts/site-mounts.ts in `vite dev`; nothing in builds. */
export function devMounts(): Plugin {
  return {
    name: "lumiose-web:dev-mounts",
    apply: "serve",
    configureServer(server) {
      const base = server.config.base;
      // Before Vite's and Lumiose's middlewares: these paths are not the website's own.
      server.middlewares.use((request: IncomingMessage, response: ServerResponse, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        let pathname: string;
        try {
          pathname = decodeURIComponent(url.pathname);
        } catch {
          return next();
        }
        const mount = MOUNTS.find(
          ({ path }) => pathname.startsWith(base + path) || `${pathname}/` === base + path,
        );
        if (mount === undefined) return next();
        const prefix = base + mount.path;
        if (pathname.length < prefix.length) {
          response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        const found = findLayout(mount, prefix);
        if (found.layout === undefined) {
          response.writeHead(404, { "content-type": TYPES[".html"]! });
          response.end(notBuilt(mount, base, found.stale));
          return;
        }
        const { file, slash } = resolve(found.layout, pathname.slice(prefix.length));
        if (slash) {
          response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
          return;
        }
        if (file !== undefined) return send(response, 200, file);
        // Like GitHub Pages with the site's 404 script: the app's own 404 page, else the site's.
        const notFound = join(found.layout[0]!.dir, "404.html");
        if (isFile(notFound)) return send(response, 404, notFound);
        next();
      });
    },
  };
}
