// Request bodies under the body and upload limits (decision-29, TASK-167), as properties
// (decision-56, TASK-313): whatever the bytes, their chunking, the content type and the limits,
// a body within its limit reads back unchanged and a larger one is a 413, and form parsing fails
// only with a 400 or a 413.
import { describe, expect, it } from "vitest";
import { fc, TIMEOUT } from "./__fixtures__/property.ts";
import {
  boundedRequest,
  checkContentLength,
  limitOf,
  parseSize,
  readFormData,
  type BodyLimits,
} from "./body.ts";
import { HttpError } from "./control.ts";

const URL_ENCODED = "application/x-www-form-urlencoded";
const TYPES = [
  URL_ENCODED,
  "application/json",
  "text/plain",
  "multipart/form-data; boundary=x",
  "",
];

/** A POST whose body arrives as `bytes` split at `cuts`. */
function chunked(bytes: Uint8Array, cuts: number[], type: string): Request {
  const points = [...new Set(cuts.map((cut) => cut % (bytes.length + 1)))].toSorted(
    (a, b) => a - b,
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let from = 0;
      for (const point of [...points, bytes.length]) {
        if (point > from) controller.enqueue(bytes.slice(from, point));
        from = Math.max(from, point);
      }
      controller.close();
    },
  });
  return new Request("https://app.test/", {
    method: "POST",
    body: stream,
    headers: type === "" ? {} : { "content-type": type },
    duplex: "half",
  } as RequestInit);
}

const limitsArb = fc.record({ body: fc.nat(2048), upload: fc.nat(4096) });

/** Resolves to what reading settled with: the value, or `{ status }` for an HttpError. */
async function settle<T>(read: Promise<T>): Promise<T | { status: number }> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status };
    if (error instanceof TypeError && (error.cause as unknown) instanceof HttpError) {
      return { status: (error.cause as HttpError).status };
    }
    throw error;
  }
}

describe("bounded bodies", () => {
  it(
    "read back unchanged within the limit, and are a 413 past it, however they are chunked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ maxLength: 3000 }),
          fc.array(fc.nat(), { maxLength: 6 }),
          fc.constantFrom(...TYPES),
          limitsArb,
          async (bytes, cuts, type, limits: BodyLimits) => {
            const request = boundedRequest(chunked(bytes, cuts, type), () => limits);
            const limit = limitOf(request.headers, limits);
            const read = await settle(request.arrayBuffer());
            if (bytes.length <= limit) {
              expect(new Uint8Array(read as ArrayBuffer)).toEqual(bytes);
            } else {
              expect(read).toEqual({ status: 413 });
            }
          },
        ),
      );
    },
    TIMEOUT,
  );

  it(
    "round-trip URL-encoded forms within the limit",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(fc.string({ unit: "grapheme" }), fc.string({ unit: "grapheme" })), {
            maxLength: 8,
          }),
          limitsArb,
          async (fields, limits) => {
            const bytes = new TextEncoder().encode(new URLSearchParams(fields).toString());
            const request = boundedRequest(chunked(bytes, [3, 17], URL_ENCODED), () => limits);
            const read = await settle(readFormData(request));
            if (bytes.length <= limits.body) {
              expect([...(read as FormData)]).toEqual(fields);
            } else {
              expect(read).toEqual({ status: 413 });
            }
          },
        ),
      );
    },
    TIMEOUT,
  );

  it(
    "round-trip multipart forms with files within the upload limit",
    async () => {
      const name = fc.stringMatching(/^[a-z][a-z0-9_]{0,8}$/);
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.tuple(name, fc.string({ unit: "grapheme" })),
              fc.tuple(name, fc.record({ file: name, bytes: fc.uint8Array({ maxLength: 600 }) })),
            ),
            { maxLength: 6 },
          ),
          limitsArb,
          async (fields, limits) => {
            const form = new FormData();
            for (const [key, value] of fields) {
              if (typeof value === "string") form.append(key, value);
              else form.append(key, new File([value.bytes], `${value.file}.bin`));
            }
            const encoded = new Request("https://app.test/", { method: "POST", body: form });
            const type = encoded.headers.get("content-type")!;
            const bytes = new Uint8Array(await encoded.arrayBuffer());
            const request = boundedRequest(chunked(bytes, [40, 41, 500], type), () => limits);
            const read = await settle(readFormData(request));
            if (bytes.length > limits.upload) {
              expect(read).toEqual({ status: 413 });
              return;
            }
            const entries = await Promise.all(
              [...(read as FormData)].map(async ([key, value]) =>
                typeof value === "string"
                  ? [key, value]
                  : [key, { file: value.name, bytes: new Uint8Array(await value.arrayBuffer()) }],
              ),
            );
            // Multipart encoding writes line breaks in values as CRLF.
            const expected = fields.map(([key, value]) =>
              typeof value === "string"
                ? [key, value.replace(/\r\n|\r|\n/g, "\r\n")]
                : [key, { file: `${value.file}.bin`, bytes: value.bytes }],
            );
            expect(entries).toEqual(expected);
          },
        ),
      );
    },
    TIMEOUT,
  );

  it(
    "round-trip JSON within the body limit",
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.jsonValue({ maxDepth: 3 }), limitsArb, async (value, limits) => {
          const text = JSON.stringify(value);
          const bytes = new TextEncoder().encode(text);
          const request = boundedRequest(chunked(bytes, [1, 9], "application/json"), () => limits);
          const read = await settle(request.json());
          if (bytes.length <= limits.body) expect(read).toEqual(JSON.parse(text));
          else expect(read).toEqual({ status: 413 });
        }),
      );
    },
    TIMEOUT,
  );
});

describe("form parsing", () => {
  it(
    "answers any body with form data, a 400 or a 413, never another error",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ maxLength: 800 }),
          fc.oneof(
            fc.constantFrom(URL_ENCODED, "multipart/form-data", "application/json", "text/plain"),
            fc.string().map((boundary) => `multipart/form-data; boundary=${boundary}`),
            fc.string(),
          ),
          fc.nat(1000),
          async (bytes, type, limit) => {
            const limits = { body: limit, upload: limit };
            const request = boundedRequest(chunked(bytes, [7], type), () => limits);
            let read: FormData | { status: number };
            try {
              read = await settle(readFormData(request));
            } catch (error) {
              // A content type the Request constructor itself refuses never reaches the parser.
              if (error instanceof TypeError && /content-type/i.test(error.message)) return;
              throw error;
            }
            if (!(read instanceof FormData)) expect([400, 413]).toContain(read.status);
          },
        ),
      );
    },
    TIMEOUT,
  );
});

describe("declared sizes", () => {
  it("refuse a Content-Length over the limit with a 413, and nothing else", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.nat().map(String), fc.string()),
        fc.constantFrom(...TYPES),
        limitsArb,
        (length, type, limits) => {
          const headers = new Headers({ "content-length": length });
          if (type !== "") headers.set("content-type", type);
          try {
            checkContentLength(headers, limits);
            expect(Number(length) > limitOf(headers, limits)).toBe(false);
          } catch (error) {
            expect(error).toMatchObject({ status: 413 });
            expect(Number(length)).toBeGreaterThan(limitOf(headers, limits));
          }
        },
      ),
    );
  });

  it("parse sizes exactly, and refuse anything that is no size", () => {
    const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
    fc.assert(
      fc.property(
        fc.nat(100_000),
        fc.constantFrom("", "b", "kb", "mb", "gb", "KB", "Mb"),
        fc.stringMatching(/^ {0,2}$/),
        (amount, unit, space) => {
          const factor = units[(unit === "" ? "b" : unit.toLowerCase()) as keyof typeof units];
          expect(parseSize(`${space}${amount}${space}${unit}${space}`, "limit")).toBe(
            amount * factor,
          );
        },
      ),
    );
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.double(), fc.anything()), (size) => {
        try {
          const bytes = parseSize(size, "limit");
          expect(Number.isSafeInteger(bytes) && bytes >= 0).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
        }
      }),
    );
  });
});
