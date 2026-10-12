// Static files of `dist/client` (assets, `public/`, prerendered pages and endpoints) for GET and
// HEAD requests below the app's `base`. Content-hashed files in the assets directory are cached
// for a year (`immutable`); everything else revalidates (ETag / Last-Modified, 304).
// With `compress`, a client that accepts brotli or gzip gets the build's precompressed `.br`/`.gz`
// copy of a file when there is one (`Vary: Accept-Encoding`).
// Page URLs follow the build's `trailingSlash`: `/about` serves `about/index.html` (`ignore`),
// redirects to `/about/` (`always`), or serves `about.html` (`never`, which redirects `/about/`).
// The directory is a build output, immutable while the server runs: it is indexed once, when the
// handler is created, so a request that no file answers (every page) costs no file system call.

import { createReadStream, readdirSync, realpathSync, statSync, type Stats } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, sep } from "node:path";
import type { BuiltAppConfig } from "@lumiose/vite/build";
import {
  acceptedEncodings,
  cacheControl,
  contentType,
  fileEtag,
  isNotModified,
  matchStaticFile,
  requestTarget,
  sameSiteLocation,
  staticPath,
  type Encoding,
} from "lumiose/node";
import { varyOnEncoding } from "./compress.ts";

// The URL rules are shared with the build's fetch handler (`lumiose/node`).
export { isHashed } from "lumiose/node";

/** Serves a request from the directory; resolves `false` when no file answers it. */
export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

export interface StaticOptions {
  /** Serve the precompressed `.br`/`.gz` copies to clients that accept them. Default: true. */
  compress?: boolean;
  /**
   * Symbolic links in `dir`: `"follow"` serves what they point to, with a startup warning for
   * links that leave `dir`; `"contain"` serves only links that stay inside it. Default: `"follow"`.
   */
  symlinks?: "follow" | "contain";
}

export function createStaticHandler(
  dir: string,
  config: BuiltAppConfig,
  options: StaticOptions = {},
): StaticHandler {
  const compress = options.compress !== false;
  const files = indexFiles(dir, options.symlinks ?? "follow");
  const has = (path: string): boolean => files.has(path);

  return async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") return false;
    // The raw target's path, never resolved as a URL: `//robots.txt` is no host (TASK-164).
    const target = requestTarget(req);
    if (target === undefined) return false;
    const query = target.search(/[?#]/);
    const url = {
      pathname: query < 0 ? target : target.slice(0, query),
      search: query < 0 ? "" : target.slice(query).replace(/#.*$/, ""),
    };
    const path = staticPath(url.pathname, config.base);
    if (path === undefined) return false;
    const match = matchStaticFile(path, url, config.trailingSlash, has);
    if (match === undefined) return false;
    if (match.redirect !== undefined) return redirect(res, match.redirect);
    return send(req, res, files.get(match.file)!, match.file, config.assetsDir, compress);
  };
}

interface FileInfo {
  absolute: string;
  stats: Stats;
  /** The build's precompressed copies (`file.br`, `file.gz`). */
  br?: FileInfo;
  gzip?: FileInfo;
}

/**
 * Every file below `dir` by its `/`-separated relative path, following symbolic links. An entry
 * that cannot be read is skipped (logged), never the whole index; links that lead outside `dir`
 * are served but reported once at startup (TASK-167 L2).
 */
function indexFiles(dir: string, symlinks: "follow" | "contain"): Map<string, FileInfo> {
  const files = new Map<string, FileInfo>();
  let root: string;
  try {
    root = realpathSync(dir);
  } catch {
    return files; // no dist/client: nothing static
  }
  const escaping: string[] = [];
  const visited = new Set<string>([root]);
  const walk = (directory: string, prefix: string) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      console.warn(`[adapter-node] cannot read ${directory}: ${(error as Error).message}`);
      return;
    }
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      const path = prefix + entry.name;
      let stats: Stats;
      try {
        stats = statSync(absolute);
        if (entry.isSymbolicLink()) {
          const target = realpathSync(absolute);
          if (target !== root && !target.startsWith(root + sep)) {
            if (symlinks === "contain") continue;
            escaping.push(`${path} -> ${target}`);
          }
          if (stats.isDirectory() && visited.has(target)) continue; // a cycle
          if (stats.isDirectory()) visited.add(target);
        }
      } catch {
        continue; // a dangling link, or an entry removed meanwhile
      }
      if (stats.isDirectory()) walk(absolute, `${path}/`);
      else if (stats.isFile()) files.set(path, { absolute, stats });
    }
  };
  walk(root, "");
  if (escaping.length > 0) {
    console.warn(
      `[adapter-node] ${dir} has symbolic links outside it, served as static files:\n  ${escaping.join("\n  ")}`,
    );
  }
  for (const [path, file] of files) {
    const br = files.get(`${path}.br`);
    const gzip = files.get(`${path}.gz`);
    if (br !== undefined) file.br = br;
    if (gzip !== undefined) file.gzip = gzip;
  }
  // Precompressed copies are served for their file (Content-Encoding), not as files of their own,
  // and `_headers` (rules for static hosts, TASK-125) is configuration (TASK-167 L6).
  // Deleting the current key while iterating a Map is safe.
  for (const path of files.keys()) {
    const original = path.replace(/\.(?:br|gz)$/, "");
    if (original !== path && files.has(original)) files.delete(path);
  }
  files.delete("_headers");
  return files;
}

function redirect(res: ServerResponse, location: string): true {
  res.writeHead(308, { location: sameSiteLocation(location) });
  res.end();
  return true;
}

/** The precompressed copy of a file for the client's encoding, if the build wrote one. */
function variantOf(
  req: IncomingMessage,
  file: FileInfo,
): { encoding: Encoding; file: FileInfo } | undefined {
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
  assetsDir: string,
  compress: boolean,
): Promise<true> {
  const variant = compress ? variantOf(req, original) : undefined;
  const { absolute, stats } = variant?.file ?? original;
  const etag = fileEtag(stats.size, stats.mtimeMs, variant?.encoding);
  const headers: Record<string, string> = {
    "cache-control": cacheControl(path, assetsDir),
    etag,
    "last-modified": stats.mtime.toUTCString(),
  };
  if (compress && (original.br !== undefined || original.gzip !== undefined)) {
    headers.vary = varyOnEncoding(undefined);
  }
  if (
    isNotModified(
      req.headers["if-none-match"],
      req.headers["if-modified-since"],
      etag,
      stats.mtime.getTime(),
    )
  ) {
    res.writeHead(304, headers);
    res.end();
    return true;
  }
  headers["content-type"] = contentType(path);
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
