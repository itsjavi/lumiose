// The static files of `dist/client` for the build's fetch handler (./serve.ts), read with
// `node:fs/promises`, which Node, Bun and Deno provide. The build's entry imports this module only
// when the build serves its own files: deploy adapters whose host serves `dist/client`
// (Cloudflare, Vercel, Netlify) leave it out of the server output.
//
// The directory is a build output, immutable while it is served: it is indexed once, on the first
// GET or HEAD request (prerendering imports the entry before `dist/client` is complete), so a
// request that no file answers (every page) costs no file system call afterwards. Same rules as
// @lumiose/adapter-node (./static-files.ts): precompressed `.br`/`.gz` copies for clients that
// accept them, `immutable` hashed assets, ETag/Last-Modified revalidation, `trailingSlash`.

import { open, readdir, realpath, stat, type FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuiltAppConfig } from "./app.ts";
import type { StaticFiles } from "./serve.ts";
import {
  acceptedEncodings,
  cacheControl,
  contentType,
  fileEtag,
  isNotModified,
  matchStaticFile,
  sameSiteLocation,
  staticPath,
  type CacheConfig,
  type Encoding,
} from "./static-files.ts";

interface FileInfo {
  absolute: string;
  size: number;
  mtimeMs: number;
  /** The build's precompressed copies (`file.br`, `file.gz`). */
  br?: FileInfo;
  gzip?: FileInfo;
}

/** Bytes read from a file per stream chunk. */
const CHUNK = 64 * 1024;

/** Serves GET and HEAD requests below the app's `base` from `dir`; `undefined` when no file answers. */
export function staticFiles(
  dir: URL | string,
  config: Pick<BuiltAppConfig, "base" | "trailingSlash"> & CacheConfig,
): StaticFiles {
  let index: Promise<Map<string, FileInfo>> | undefined;
  return async (request, url) => {
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;
    const path = staticPath(url.pathname, config.base);
    if (path === undefined) return undefined;
    const files = await (index ??= indexFiles(typeof dir === "string" ? dir : fileURLToPath(dir)));
    if (files.size === 0) return undefined;
    const match = matchStaticFile(path, url, config.trailingSlash, (file) => files.has(file));
    if (match === undefined) return undefined;
    if (match.redirect !== undefined) {
      return new Response(null, {
        status: 308,
        headers: { location: sameSiteLocation(match.redirect) },
      });
    }
    return send(request, files.get(match.file)!, match.file, config);
  };
}

async function send(
  request: Request,
  original: FileInfo,
  file: string,
  config: CacheConfig,
): Promise<Response | undefined> {
  const variant = variantOf(request.headers.get("accept-encoding"), original);
  const { absolute, size, mtimeMs } = variant?.file ?? original;
  const etag = fileEtag(size, mtimeMs, variant?.encoding);
  const headers = new Headers({
    "cache-control": cacheControl(file, config),
    etag,
    "last-modified": new Date(mtimeMs).toUTCString(),
  });
  if (original.br !== undefined || original.gzip !== undefined) {
    headers.set("vary", "accept-encoding");
  }
  if (
    isNotModified(
      request.headers.get("if-none-match"),
      request.headers.get("if-modified-since"),
      etag,
      mtimeMs,
    )
  ) {
    return new Response(null, { status: 304, headers });
  }
  headers.set("content-type", contentType(file));
  if (variant !== undefined) headers.set("content-encoding", variant.encoding);
  headers.set("content-length", String(size));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  let handle: FileHandle;
  try {
    handle = await open(absolute);
  } catch {
    return undefined; // removed since the index was built: the app answers
  }
  return new Response(fileStream(handle), { status: 200, headers });
}

/** The precompressed copy of a file for the client's encoding, if the build wrote one. */
function variantOf(
  accept: string | null,
  file: FileInfo,
): { encoding: Encoding; file: FileInfo } | undefined {
  if (file.br === undefined && file.gzip === undefined) return undefined;
  // br first, then gzip: a client that accepts both but finds no .br still gets the .gz.
  for (const encoding of acceptedEncodings(accept)) {
    const copy = file[encoding];
    if (copy !== undefined) return { encoding, file: copy };
  }
  return undefined;
}

/** The file's bytes as a stream, read as the consumer pulls; the file closes at the end or on cancel. */
function fileStream(handle: FileHandle): ReadableStream<Uint8Array> {
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await handle.close().catch(() => {});
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const buffer = new Uint8Array(CHUNK);
        const { bytesRead } = await handle.read(buffer, 0, CHUNK, null);
        if (bytesRead === 0) {
          await close();
          controller.close();
          return;
        }
        controller.enqueue(bytesRead === CHUNK ? buffer : buffer.subarray(0, bytesRead));
      } catch (error) {
        await close();
        controller.error(error);
      }
    },
    cancel: close,
  });
}

/**
 * Every file below `dir` by its `/`-separated relative path, following symbolic links (a linked
 * directory once). An entry that cannot be read is skipped; a missing `dir` has no files.
 */
async function indexFiles(dir: string): Promise<Map<string, FileInfo>> {
  const files = new Map<string, FileInfo>();
  let root: string;
  try {
    root = await realpath(dir);
  } catch {
    return files;
  }
  const visited = new Set<string>([root]);
  const walk = async (directory: string, prefix: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const absolute = join(directory, entry.name);
        const path = prefix + entry.name;
        let stats;
        try {
          stats = await stat(absolute);
          if (entry.isSymbolicLink() && stats.isDirectory()) {
            const target = await realpath(absolute);
            if (visited.has(target)) return; // a cycle, or a directory linked twice
            visited.add(target);
          }
        } catch {
          return; // a dangling link, or an entry removed meanwhile
        }
        if (stats.isDirectory()) await walk(absolute, `${path}/`);
        else if (stats.isFile()) {
          files.set(path, { absolute, size: stats.size, mtimeMs: stats.mtimeMs });
        }
      }),
    );
  };
  await walk(root, "");
  for (const [path, file] of files) {
    const br = files.get(`${path}.br`);
    const gzip = files.get(`${path}.gz`);
    if (br !== undefined) file.br = br;
    if (gzip !== undefined) file.gzip = gzip;
  }
  // Precompressed copies are served for their file (Content-Encoding), not as files of their own,
  // and `_headers` (rules for static hosts) is configuration.
  for (const path of files.keys()) {
    const original = path.replace(/\.(?:br|gz)$/, "");
    if (original !== path && files.has(original)) files.delete(path);
  }
  files.delete("_headers");
  return files;
}
