// Bounded request bodies (decision-29, TASK-167): URL-encoded, JSON and other bodies are capped at
// `limits.body` (1 MB by default), multipart bodies (uploads) at `limits.upload` (10 MB). Larger
// requests get `413 Payload Too Large`: refused before reading when `Content-Length` says so,
// otherwise as soon as the bytes read pass the limit. `lumiose({ limits })` sets the app's limits and
// a route's `export const limits` its own; the handler bounds every request body (actions,
// endpoints and middleware read the bounded body), so nothing buffers an unbounded one.

import { HttpError } from "./control.ts";

/** Sizes in bytes, or strings such as `"512kb"`, `"1mb"`, `"2.5gb"` (1024-based). */
export type Size = number | string;

/** `lumiose({ limits })` and a route's `export const limits`. */
export interface LimitsOption {
  /** URL-encoded forms, JSON and any other non-multipart body. Default: `"1mb"`. */
  body?: Size;
  /** `multipart/form-data` bodies (file uploads). Default: `"10mb"`. */
  upload?: Size;
}

export interface BodyLimits {
  body: number;
  upload: number;
}

export const DEFAULT_LIMITS: BodyLimits = { body: 1024 * 1024, upload: 10 * 1024 * 1024 };

const UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/**
 * Bytes of a size; throws a `TypeError` naming `what` for anything else, and for sizes past
 * `Number.MAX_SAFE_INTEGER` bytes (a long digit string would otherwise become `Infinity`, no
 * limit at all; TASK-313).
 */
export function parseSize(size: unknown, what: string): number {
  let bytes: number | undefined;
  if (typeof size === "number" && size >= 0) bytes = Math.floor(size);
  if (typeof size === "string") {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(size);
    if (match !== null) {
      bytes = Math.floor(Number(match[1]) * UNITS[(match[2] ?? "b").toLowerCase()]!);
    }
  }
  if (bytes !== undefined && Number.isSafeInteger(bytes)) return bytes;
  throw new TypeError(
    `${what}: expected a size in bytes (at most 2^53 - 1) or a string like "1mb" or "512kb", got ${JSON.stringify(size)}`,
  );
}

/** `option` over `base`, each set size parsed. */
export function resolveLimits(option: unknown, base: BodyLimits, what: string): BodyLimits {
  if (option === undefined) return base;
  if (typeof option !== "object" || option === null || Array.isArray(option)) {
    throw new TypeError(`${what}: expected { body?, upload? }, got ${JSON.stringify(option)}`);
  }
  const limits = { ...base };
  for (const [key, value] of Object.entries(option)) {
    if (key !== "body" && key !== "upload") {
      throw new TypeError(`${what}.${key}: unknown limit. Known limits: body, upload`);
    }
    if (value !== undefined) limits[key] = parseSize(value, `${what}.${key}`);
  }
  return limits;
}

function isMultipart(headers: Headers): boolean {
  return /^\s*multipart\/form-data\b/i.test(headers.get("content-type") ?? "");
}

/**
 * The limit that applies to a request's body: `upload` for multipart, `body` otherwise (and for
 * `json()` and `text()`, see `boundedRequest()`).
 */
export function limitOf(headers: Headers, limits: BodyLimits): number {
  return isMultipart(headers) ? limits.upload : limits.body;
}

export function payloadTooLarge(limit: number): HttpError {
  return new HttpError(413, `The request body is larger than ${limit} bytes.`);
}

/** Throws 413 when the request declares a `Content-Length` above its limit. */
export function checkContentLength(headers: Headers, limits: BodyLimits): void {
  const declared = headers.get("content-length");
  const limit = limitOf(headers, limits);
  if (declared !== null && Number(declared) > limit) throw payloadTooLarge(limit);
}

/**
 * The request with its body bounded by `limits()`, read on every chunk so that a route's own
 * limits (known once its module loaded) apply to reads after that. A body-less request is
 * returned as is.
 *
 * The client's Content-Type picks the limit, so `request.json()` and `request.text()`, which
 * never parse multipart, keep `body` even for a body declared `multipart/form-data` (TASK-472):
 * declaring it must not raise a JSON endpoint's limit to `upload`. `formData()` and raw reads
 * (`arrayBuffer()`, the stream, for a parser of your own) of a multipart body get `upload`.
 * `clone()` keeps this (TASK-500); a request re-wrapped with `new Request(request)` has the plain
 * `json()` and `text()`, which read its multipart body under `upload` (documented).
 */
export function boundedRequest(request: Request, limits: () => BodyLimits): Request {
  if (request.body === null) return request;
  let total = 0;
  const reads = { plain: false };
  const body = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        const limit = reads.plain ? limits().body : limitOf(request.headers, limits());
        if (total > limit) controller.error(payloadTooLarge(limit));
        else controller.enqueue(chunk);
      },
    }),
  );
  return withPlainReads(new Request(request, { body, duplex: "half" } as RequestInit), reads);
}

/**
 * `request` whose `json()` and `text()` switch the shared body to the `body` limit, and whose
 * clones do the same: a clone's body is a branch of the bounded stream, so a read through any of
 * them bounds all of them.
 */
function withPlainReads(request: Request, reads: { plain: boolean }): Request {
  for (const name of ["json", "text"] as const) {
    const read = Request.prototype[name];
    own(request, name, function (this: Request) {
      reads.plain = true;
      return read.call(this);
    });
  }
  const clone = Request.prototype.clone;
  own(request, "clone", function (this: Request) {
    return withPlainReads(clone.call(this), reads);
  });
  return request;
}

function own(request: Request, name: string, value: (this: Request) => unknown): void {
  Object.defineProperty(request, name, { configurable: true, writable: true, value });
}

/**
 * The request's form data (400 when the body is no form). The handler already bounds the body;
 * a 413 from it propagates.
 */
export async function readFormData(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  const essence = type.split(";", 1)[0]!.trim().toLowerCase();
  if (essence !== "application/x-www-form-urlencoded" && essence !== "multipart/form-data") {
    throw notForm();
  }
  // Read the bytes first, so a 413 from the bounded stream is not mistaken for a parse error.
  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    return await new Response(bytes, { headers: { "content-type": type } }).formData();
  } catch {
    throw notForm();
  }
}

function notForm(): HttpError {
  return new HttpError(400, "The request body is not form data.");
}
