// Precompressed copies of the client build (TASK-121): `lumiose build` writes `file.br` (brotli,
// quality 11) and `file.gz` (gzip, level 9) next to every compressible file of `dist/client` of
// at least 1 kB, when the copy is smaller. `@lumiose/adapter-node` serves them to clients that accept
// the encoding, so static files cost no compression time per request.
//
// Brotli 11 is slow (1.3 s for the itsjavi.com port's 564 kB editor chunk), and it was half that
// build's time, one file after another (TASK-288). Files now compress four at a time, largest
// first, and the client build's files start while the server build and prerendering run.

import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

/** Extensions of text formats worth compressing (images, fonts and media already are). */
export const COMPRESSIBLE_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".map",
  ".webmanifest",
  ".xml",
  ".txt",
  ".md",
  ".csv",
  ".svg",
  ".wasm",
]);

/** Smaller files gain too little to be worth a second request path. */
export const PRECOMPRESS_MIN_BYTES = 1024;

export interface PrecompressResult {
  /** Files that got at least one compressed copy. */
  files: number;
  /** Total bytes of those files, and of their brotli copies. */
  bytes: number;
  brotliBytes: number;
}

/**
 * Files compressed at once. Node's zlib runs them on libuv's thread pool, 4 threads by default:
 * more would only queue (TASK-288).
 */
const CONCURRENCY = 4;

/** A precompression started in the background (`startPrecompress()`). */
export interface Precompression {
  /**
   * Compresses the files of `dir` not compressed yet, or changed since, and resolves with the
   * result of both passes.
   */
  finish(): Promise<PrecompressResult>;
}

/** What one file's copies came to, and the file as it was read. */
interface Compressed {
  size: number;
  mtimeMs: number;
  brotliBytes: number | undefined;
  gzipBytes: number | undefined;
}

/**
 * Starts writing the copies of `early` (paths below `dir`) in the background, while the build goes
 * on (TASK-288): the client build's files named by content hash, which nothing rewrites, compress
 * during the server build and prerendering instead of after them. `finish()` then does the rest.
 */
export function startPrecompress(dir: string, early: Iterable<string>): Precompression {
  const done = new Map<string, Compressed>();
  const first = compressAll(
    [...early].map((file) => join(dir, file)),
    done,
  );
  // A build that fails before `finish()` must not end with an unhandled rejection.
  first.catch(() => {});
  return {
    async finish() {
      await first;
      const rest: string[] = [];
      for (const file of await listFiles(dir)) {
        const before = done.get(file);
        if (before === undefined) rest.push(file);
        else {
          const now = await stat(file).catch(() => undefined);
          if (now === undefined) done.delete(file);
          else if (now.size !== before.size || now.mtimeMs !== before.mtimeMs) rest.push(file);
        }
      }
      await compressAll(rest, done);
      const result: PrecompressResult = { files: 0, bytes: 0, brotliBytes: 0 };
      for (const file of done.values()) {
        if (file.brotliBytes === undefined && file.gzipBytes === undefined) continue;
        result.files++;
        result.bytes += file.size;
        result.brotliBytes += file.brotliBytes ?? 0;
      }
      return result;
    },
  };
}

/** Writes `.br` and `.gz` copies of the compressible files below `dir` (see the top of the file). */
export async function precompress(dir: string): Promise<PrecompressResult> {
  return startPrecompress(dir, []).finish();
}

/** Compresses `files` (absolute), `CONCURRENCY` at a time, largest first, recording each in `done`. */
async function compressAll(files: readonly string[], done: Map<string, Compressed>): Promise<void> {
  const queue: { file: string; size: number; mtimeMs: number }[] = [];
  for (const file of files) {
    if (!COMPRESSIBLE_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const stats = await stat(file).catch(() => undefined);
    if (stats === undefined || !stats.isFile() || stats.size < PRECOMPRESS_MIN_BYTES) continue;
    queue.push({ file, size: stats.size, mtimeMs: stats.mtimeMs });
  }
  // Largest first: a large file started last would compress alone while the other threads idle.
  queue.sort((a, b) => b.size - a.size);
  const next = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      done.set(item.file, await compress(item.file, item.size, item.mtimeMs, done.get(item.file)));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, next));
}

/**
 * Writes the copies of one file that are smaller than it. A copy written for an earlier version of
 * the file that is no longer smaller is removed, so it cannot serve stale bytes.
 */
async function compress(
  file: string,
  size: number,
  mtimeMs: number,
  before: Compressed | undefined,
): Promise<Compressed> {
  const source = await readFile(file);
  const [br, gzipped] = await Promise.all([
    brotli(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
        [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
    gz(source, { level: constants.Z_BEST_COMPRESSION }),
  ]);
  const brotliBytes = br.length < source.length ? br.length : undefined;
  const gzipBytes = gzipped.length < source.length ? gzipped.length : undefined;
  if (brotliBytes !== undefined) await writeFile(`${file}.br`, br);
  else if (before?.brotliBytes !== undefined) await rm(`${file}.br`, { force: true });
  if (gzipBytes !== undefined) await writeFile(`${file}.gz`, gzipped);
  else if (before?.gzipBytes !== undefined) await rm(`${file}.gz`, { force: true });
  return { size, mtimeMs, brotliBytes, gzipBytes };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}
