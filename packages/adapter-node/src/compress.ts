// Response compression (TASK-121). Static files use the build's precompressed `.br`/`.gz` copies
// (static.ts); the app's responses (pages, endpoints) are compressed on the fly here, brotli at a
// fast quality or gzip, as the client accepts. Streamed HTML stays streamed: the compressor is
// flushed whenever the app's body pauses, so every chunk the app sent reaches the client.

import {
  constants,
  createBrotliCompress,
  createGzip,
  type BrotliCompress,
  type Gzip,
} from "node:zlib";

// Shared with the build's fetch handler (`lumiose/node`).
import { acceptedEncodings, type Encoding } from "lumiose/node";

export { acceptedEncodings, type Encoding };

/** Below this size a known-length response is sent as is. */
const MIN_BYTES = 1024;
/** Brotli 4 compresses HTML about as well as gzip 9, several times faster than brotli 11. */
const BROTLI_QUALITY = 4;
const GZIP_LEVEL = 6;

const COMPRESSIBLE_TYPE =
  /^(?:text\/|application\/(?:json|[\w.+-]*\+json|javascript|ecmascript|xml|[\w.+-]*\+xml|manifest\+json|wasm)|image\/svg\+xml)/i;

/** The encoding for a response to compress on the fly, if any. */
export function negotiateEncoding(accept: string | string[] | undefined): Encoding | undefined {
  return acceptedEncodings(accept)[0];
}

export function isCompressibleType(contentType: string | null | undefined): boolean {
  return contentType != null && COMPRESSIBLE_TYPE.test(contentType);
}

/** Adds `accept-encoding` to a `Vary` header value. */
export function varyOnEncoding(vary: string | null | undefined): string {
  if (vary == null || vary.trim() === "") return "accept-encoding";
  const names = vary.split(",").map((name) => name.trim().toLowerCase());
  return names.includes("accept-encoding") || names.includes("*")
    ? vary
    : `${vary}, accept-encoding`;
}

/**
 * The response compressed with `encoding`, or the response itself when compressing would not
 * help: no body, a status without content, already encoded, not a text format, or a known length
 * below 1 kB.
 */
export function compressResponse(
  response: Response,
  encoding: Encoding | undefined,
  method: string | undefined,
): Response {
  const headers = response.headers;
  if (!isCompressibleType(headers.get("content-type"))) return response;
  // Whatever the request accepted, caches must know the response depends on it.
  const vary = varyOnEncoding(headers.get("vary"));
  if (
    encoding === undefined ||
    response.body === null ||
    method === "HEAD" ||
    response.status === 204 ||
    response.status === 206 ||
    response.status === 304 ||
    headers.has("content-encoding") ||
    /\bno-transform\b/i.test(headers.get("cache-control") ?? "")
  ) {
    return withVary(response, vary);
  }
  const length = Number(headers.get("content-length") ?? Number.NaN);
  if (length < MIN_BYTES) return withVary(response, vary);
  const compressed = new Headers(headers);
  compressed.set("content-encoding", encoding);
  compressed.set("vary", vary);
  compressed.delete("content-length");
  // A strong ETag names the identity bytes; the encoded body is a different representation.
  const etag = compressed.get("etag");
  if (etag !== null && !etag.startsWith("W/")) compressed.set("etag", `W/${etag}`);
  return new Response(compressStream(response.body, encoding), {
    status: response.status,
    statusText: response.statusText,
    headers: compressed,
  });
}

function withVary(response: Response, vary: string): Response {
  if (response.headers.get("vary") === vary) return response;
  try {
    response.headers.set("vary", vary);
  } catch {
    // Immutable headers (`Response.redirect()`, `Response.error()`): leave them as they are.
  }
  return response;
}

function compressStream(
  body: ReadableStream<Uint8Array>,
  encoding: Encoding,
): ReadableStream<Uint8Array> {
  const compressor: BrotliCompress | Gzip =
    encoding === "br"
      ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY } })
      : createGzip({ level: GZIP_LEVEL });
  const flushKind = encoding === "br" ? constants.BROTLI_OPERATION_FLUSH : constants.Z_SYNC_FLUSH;
  const reader = body.getReader();
  let flushTimer: ReturnType<typeof setImmediate> | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      compressor.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      compressor.once("end", () => controller.close());
      compressor.once("error", (error) => controller.error(error));
      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            clearImmediate(flushTimer);
            if (!compressor.write(value)) {
              await new Promise((resolve) => compressor.once("drain", resolve));
            }
            // Flush once the app's body pauses (a streamed Suspense boundary), not per chunk:
            // flushing ends a compression block, which costs ratio.
            flushTimer = setImmediate(() => compressor.flush(flushKind));
          }
          clearImmediate(flushTimer);
          compressor.end();
        } catch (error) {
          clearImmediate(flushTimer);
          compressor.destroy(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    },
    cancel(reason) {
      clearImmediate(flushTimer);
      compressor.destroy();
      return reader.cancel(reason);
    },
  });
}
