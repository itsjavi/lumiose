// Bounded request bodies (TASK-167 H1): a form action's `ctx.formData()` reads at most
// `FORM_LIMITS` bytes, rejecting a larger `Content-Length` before reading anything and counting
// the bytes of a streamed body, with `413 Payload Too Large`. `limitedStream()` caps any body (the
// Node bridge applies `MAX_BODY_BYTES` to every request it builds).
//
// The values are internal defaults: a public option (its name, shape and defaults) awaits the
// user's approval.

import { HttpError } from "./control.ts";

/** Per form encoding: URL-encoded fields, and multipart bodies (file uploads). */
export const FORM_LIMITS = { urlencoded: 1024 * 1024, multipart: 16 * 1024 * 1024 } as const;
/** Any request body through the Node bridge (dev server, adapter-node, preview). */
export const MAX_BODY_BYTES = FORM_LIMITS.multipart;

export function payloadTooLarge(limit: number): HttpError {
  return new HttpError(413, `The request body is larger than ${limit} bytes.`);
}

/** Throws 413 when the request declares a `Content-Length` above `limit`. */
export function checkContentLength(headers: Headers, limit: number): void {
  const declared = headers.get("content-length");
  if (declared !== null && Number(declared) > limit) throw payloadTooLarge(limit);
}

/** `body`, erroring with a 413 `HttpError` once more than `limit` bytes went through. */
export function limitedStream(
  body: ReadableStream<Uint8Array>,
  limit: number,
): ReadableStream<Uint8Array> {
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > limit) controller.error(payloadTooLarge(limit));
        else controller.enqueue(chunk);
      },
    }),
  );
}

/** The bytes of a request body, at most `limit` of them (413 beyond). */
async function readBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  checkContentLength(request.headers, limit);
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      reader.cancel().catch(() => {});
      throw payloadTooLarge(limit);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * The request's form data, read within {@link FORM_LIMITS}: 400 when the body is no form, 413
 * when it is too large.
 */
export async function readFormData(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  const essence = type.split(";", 1)[0]!.trim().toLowerCase();
  if (essence === "application/x-www-form-urlencoded") {
    const text = new TextDecoder().decode(await readBytes(request, FORM_LIMITS.urlencoded));
    const form = new FormData();
    for (const [name, value] of new URLSearchParams(text)) form.append(name, value);
    return form;
  }
  if (essence === "multipart/form-data") {
    const bytes = await readBytes(request, FORM_LIMITS.multipart);
    try {
      return await new Response(bytes, { headers: { "content-type": type } }).formData();
    } catch {
      throw notForm();
    }
  }
  throw notForm();
}

function notForm(): HttpError {
  return new HttpError(400, "The request body is not form data.");
}
