// Precompressed copies of the client build (TASK-121): `lumiose build` writes `file.br` (brotli,
// quality 11) and `file.gz` (gzip, level 9) next to every compressible file of `dist/client` of
// at least 1 kB, when the copy is smaller. `@lumiose/adapter-node` serves them to clients that accept
// the encoding, so static files cost no compression time per request.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
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

export async function precompress(dir: string): Promise<PrecompressResult> {
  const result: PrecompressResult = { files: 0, bytes: 0, brotliBytes: 0 };
  for (const file of await listFiles(dir)) {
    if (!COMPRESSIBLE_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const { size } = await stat(file);
    if (size < PRECOMPRESS_MIN_BYTES) continue;
    const source = await readFile(file);
    const [br, gzipped] = await Promise.all([
      brotli(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: size,
        },
      }),
      gz(source, { level: constants.Z_BEST_COMPRESSION }),
    ]);
    let wrote = false;
    if (br.length < size) {
      await writeFile(`${file}.br`, br);
      result.brotliBytes += br.length;
      wrote = true;
    }
    if (gzipped.length < size) {
      await writeFile(`${file}.gz`, gzipped);
      wrote = true;
    }
    if (wrote) {
      result.files++;
      result.bytes += size;
    }
  }
  return result;
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}
