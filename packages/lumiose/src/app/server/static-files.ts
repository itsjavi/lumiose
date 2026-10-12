// Static files of `dist/client` (assets, `public/`, prerendered pages and endpoints) by request URL,
// shared by the servers of a build: @lumiose/adapter-node (Node streams) and the build's fetch
// handler (./static-fs.ts, for Bun and Deno). No I/O here: callers look files up in their index.
//
// Content-hashed files in the assets directory are cached for a year (`immutable`); everything else
// revalidates (ETag / Last-Modified, 304). Page URLs follow the build's `trailingSlash`: `/about`
// serves `about/index.html` (`ignore`), redirects to `/about/` (`always`), or serves `about.html`
// (`never`, which redirects `/about/`).

import type { TrailingSlash } from "./handler.ts";

export const MIME_TYPES: Readonly<Record<string, string>> = {
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

export const IMMUTABLE = "public, max-age=31536000, immutable";
export const REVALIDATE = "public, max-age=0, must-revalidate";

/** The content type of a file, by extension. */
export function contentType(file: string): string {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  // As `path.extname()`: a leading dot starts no extension.
  return (dot > 0 && MIME_TYPES[name.slice(dot).toLowerCase()]) || "application/octet-stream";
}

/**
 * The decoded path below `base`, without its leading slash; `undefined` outside `base` or for
 * paths that must not reach the file system (`..`, dot files other than `.well-known`, NUL).
 */
export function staticPath(pathname: string, base: string): string | undefined {
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

/** The file that answers a request, or where to redirect it for the trailing-slash policy. */
export type StaticMatch = { file: string; redirect?: undefined } | { redirect: string };

/**
 * What answers `path` (from {@link staticPath}) when `has(file)` tells which files exist:
 * `undefined` when no file does. `url` is the request's, for redirect locations.
 */
export function matchStaticFile(
  path: string,
  url: { pathname: string; search: string },
  trailingSlash: TrailingSlash,
  has: (file: string) => boolean,
): StaticMatch | undefined {
  if (path === "" || path.endsWith("/")) {
    const index = has(`${path}index.html`);
    if (path !== "" && trailingSlash === "never") {
      if (has(`${path.slice(0, -1)}.html`) || index) {
        return { redirect: `${url.pathname.replace(/\/+$/, "")}${url.search}` };
      }
    }
    return index ? { file: `${path}index.html` } : undefined;
  }
  if (has(path)) return { file: path };
  if (trailingSlash !== "always" && has(`${path}.html`)) return { file: `${path}.html` };
  if (!has(`${path}/index.html`)) return undefined;
  if (trailingSlash === "always") return { redirect: `${url.pathname}/${url.search}` };
  return { file: `${path}/index.html` };
}

/** A redirect location that stays on the site: `//evil.com` (or `/\evil.com`) would leave it. */
export function sameSiteLocation(location: string): string {
  return location.replace(/^[/\\]+/, "/");
}

/**
 * Whether a file name carries a build hash (Vite's `name-[hash].ext`: 8+ word characters with a
 * digit or an uppercase letter), so its URL changes with its content and it can be cached for a
 * year. Other files under the assets directory revalidate (TASK-167 L5).
 */
export function isHashed(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1);
  // A hash with a `-` inside fails the test: the file then revalidates, which is only slower.
  return /[-.](?=\w*[\dA-Z])\w{8,}\.[^.]+$/.test(name);
}

/** `Cache-Control` of a file: a year for hashed files in the assets directory, else revalidate. */
export function cacheControl(file: string, assetsDir: string): string {
  const prefix = `${assetsDir.replace(/^\/+|\/+$/g, "")}/`;
  return file.startsWith(prefix) && isHashed(file) ? IMMUTABLE : REVALIDATE;
}

export type Encoding = "br" | "gzip";

/** The encodings `Accept-Encoding` allows, in order of preference: brotli, then gzip (`q=0` excludes). */
export function acceptedEncodings(accept: string | string[] | null | undefined): Encoding[] {
  const header = Array.isArray(accept) ? accept.join(",") : (accept ?? "");
  const weights = new Map<string, number>();
  for (const part of header.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    if (name === undefined || name === "") continue;
    const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find((v) => v !== undefined);
    weights.set(name, q === undefined ? 1 : Number(q));
  }
  const weight = (name: string) => weights.get(name) ?? weights.get("*") ?? 0;
  return (["br", "gzip"] as const).filter((encoding) => weight(encoding) > 0);
}

/** The weak ETag of a file version: size and modification time, plus the encoding of a copy. */
export function fileEtag(size: number, mtimeMs: number, encoding?: Encoding): string {
  const tag = `${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}`;
  return `W/"${encoding === undefined ? tag : `${tag}-${encoding}`}"`;
}

/** Whether the conditional request headers match the file (answer 304). */
export function isNotModified(
  ifNoneMatch: string | null | undefined,
  ifModifiedSince: string | null | undefined,
  etag: string,
  mtimeMs: number,
): boolean {
  if (ifNoneMatch != null) {
    return ifNoneMatch.split(",").some((tag) => tag.trim() === etag || tag.trim() === "*");
  }
  if (ifModifiedSince == null) return false;
  const since = Date.parse(ifModifiedSince);
  return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) <= Math.floor(since / 1000);
}
