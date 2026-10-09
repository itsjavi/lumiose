// Static files of `dist/client` (assets, `public/`, prerendered pages and endpoints) for GET and
// HEAD requests below the app's `base`. Content-hashed files in the assets directory are cached
// for a year (`immutable`); everything else revalidates (ETag / Last-Modified, 304).
// With `compress`, a client that accepts brotli or gzip gets the build's precompressed `.br`/`.gz`
// copy of a file when there is one (`Vary: Accept-Encoding`).
// Page URLs follow the build's `trailingSlash`: `/about` serves `about/index.html` (`ignore`),
// redirects to `/about/` (`always`), or serves `about.html` (`never`, which redirects `/about/`).
// The directory is a build output, immutable while the server runs: it is indexed once, when the
// handler is created, so a request that no file answers (every page) costs no file system call.

import { createReadStream, readdirSync, statSync, type Stats } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, relative, sep } from "node:path";
import type { BuiltAppConfig } from "lumen/build";
import { acceptedEncodings, varyOnEncoding } from "./compress.ts";

/** Serves a request from the directory; resolves `false` when no file answers it. */
export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, max-age=0, must-revalidate";

export interface StaticOptions {
  /** Serve the precompressed `.br`/`.gz` copies to clients that accept them. Default: true. */
  compress?: boolean;
}

export function createStaticHandler(
  dir: string,
  config: BuiltAppConfig,
  options: StaticOptions = {},
): StaticHandler {
  const compress = options.compress !== false;
  const assetsPrefix = `${config.assetsDir.replace(/^\/+|\/+$/g, "")}/`;
  const files = indexFiles(dir);
  const fileStats = (path: string): FileInfo | undefined => files.get(path);

  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = relativePath(url.pathname, config.base);
    if (path === undefined) return false;

    if (path === "" || path.endsWith("/")) {
      const index = fileStats(`${path}index.html`);
      if (path !== "" && config.trailingSlash === "never") {
        const page = fileStats(`${path.slice(0, -1)}.html`);
        if (page !== undefined || index !== undefined) {
          return redirect(res, `${url.pathname.replace(/\/+$/, "")}${url.search}`);
        }
      }
      return index === undefined
        ? false
        : send(req, res, index, `${path}index.html`, false, compress);
    }
    const file = fileStats(path);
    if (file !== undefined) {
      return send(req, res, file, path, path.startsWith(assetsPrefix), compress);
    }
    if (config.trailingSlash !== "always") {
      const page = fileStats(`${path}.html`);
      if (page !== undefined) return send(req, res, page, `${path}.html`, false, compress);
    }
    const index = fileStats(`${path}/index.html`);
    if (index === undefined) return false;
    if (config.trailingSlash === "always") return redirect(res, `${url.pathname}/${url.search}`);
    return send(req, res, index, `${path}/index.html`, false, compress);
  };
}

/**
 * The decoded path below `base`, without its leading slash; `undefined` outside `base` or for
 * paths that must not reach the file system (`..`, dot files other than `.well-known`, NUL).
 */
function relativePath(pathname: string, base: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  let path: string;
  if (decoded === base.slice(0, -1)) path = "";
  else if (decoded.startsWith(base)) path = decoded.slice(base.length);
  else return undefined;
  for (const segment of path.split("/")) {
    if (segment === "..") return undefined;
    if (segment.startsWith(".") && segment !== ".well-known") return undefined;
    if (segment.includes("\\") || segment.includes("\0")) return undefined;
  }
  return path;
}

interface FileInfo {
  absolute: string;
  stats: Stats;
  /** The build's precompressed copies (`file.br`, `file.gz`). */
  br?: FileInfo;
  gzip?: FileInfo;
}

/** Every file below `dir` (symbolic links followed) by its `/`-separated relative path. */
function indexFiles(dir: string): Map<string, FileInfo> {
  const files = new Map<string, FileInfo>();
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return files; // no dist/client: nothing static
  }
  for (const entry of entries) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const absolute = join(entry.parentPath, entry.name);
    let stats: Stats;
    try {
      stats = statSync(absolute);
    } catch {
      continue; // a dangling link
    }
    if (stats.isFile())
      files.set(relative(dir, absolute).split(sep).join("/"), { absolute, stats });
  }
  for (const [path, file] of files) {
    const br = files.get(`${path}.br`);
    const gzip = files.get(`${path}.gz`);
    if (br !== undefined) file.br = br;
    if (gzip !== undefined) file.gzip = gzip;
  }
  return files;
}

function redirect(res: ServerResponse, location: string): true {
  res.writeHead(308, { location });
  res.end();
  return true;
}

/** The precompressed copy of a file for the client's encoding, if the build wrote one. */
function variantOf(
  req: IncomingMessage,
  file: FileInfo,
): { encoding: string; file: FileInfo } | undefined {
  if (file.br === undefined && file.gzip === undefined) return undefined;
  // br first, then gzip: a client that accepts both but finds no .br still gets the .gz.
  for (const encoding of acceptedEncodings(req.headers["accept-encoding"])) {
    const copy = file[encoding];
    if (copy !== undefined) return { encoding, file: copy };
  }
  return undefined;
}

async function send(
  req: IncomingMessage,
  res: ServerResponse,
  original: FileInfo,
  path: string,
  immutable: boolean,
  compress: boolean,
): Promise<true> {
  const variant = compress ? variantOf(req, original) : undefined;
  const { absolute, stats } = variant?.file ?? original;
  const tag = `${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}`;
  const etag = `W/"${variant === undefined ? tag : `${tag}-${variant.encoding}`}"`;
  const lastModified = stats.mtime.toUTCString();
  const headers: Record<string, string> = {
    "cache-control": immutable ? IMMUTABLE : REVALIDATE,
    etag,
    "last-modified": lastModified,
  };
  if (compress && (original.br !== undefined || original.gzip !== undefined)) {
    headers.vary = varyOnEncoding(undefined);
  }
  if (notModified(req, etag, stats.mtime)) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  headers["content-type"] = MIME_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
  if (variant !== undefined) headers["content-encoding"] = variant.encoding;
  headers["content-length"] = String(stats.size);
  res.writeHead(200, headers);
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  return new Promise((resolve, reject) => {
    const stream = createReadStream(absolute);
    stream.on("error", (error) => {
      res.destroy(error);
      reject(error);
    });
    res.on("close", () => {
      stream.destroy();
      resolve(true);
    });
    stream.pipe(res);
  });
}

function notModified(req: IncomingMessage, etag: string, mtime: Date): boolean {
  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch !== undefined) {
    return ifNoneMatch.split(",").some((tag) => tag.trim() === etag || tag.trim() === "*");
  }
  const ifModifiedSince = req.headers["if-modified-since"];
  if (ifModifiedSince === undefined) return false;
  const since = Date.parse(ifModifiedSince);
  return !Number.isNaN(since) && Math.floor(mtime.getTime() / 1000) <= Math.floor(since / 1000);
}
