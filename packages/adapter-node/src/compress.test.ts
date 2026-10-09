import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  brotliCompressSync,
  brotliDecompressSync,
  createBrotliDecompress,
  gunzipSync,
  gzipSync,
} from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptedEncodings,
  compressResponse,
  negotiateEncoding,
  varyOnEncoding,
} from "./compress.ts";
import { createStaticHandler } from "./static.ts";

const BIG_JS = `console.log(${JSON.stringify("x".repeat(4000))});`;

describe("negotiateEncoding", () => {
  it("prefers brotli, falls back to gzip and honours q=0", () => {
    expect(negotiateEncoding("gzip, deflate, br")).toBe("br");
    expect(negotiateEncoding("gzip")).toBe("gzip");
    expect(negotiateEncoding("br;q=0, gzip;q=0.5")).toBe("gzip");
    expect(negotiateEncoding("*")).toBe("br");
    expect(negotiateEncoding("identity")).toBeUndefined();
    expect(negotiateEncoding(undefined)).toBeUndefined();
    expect(acceptedEncodings("br, gzip")).toEqual(["br", "gzip"]);
  });

  it("adds accept-encoding to Vary once", () => {
    expect(varyOnEncoding(null)).toBe("accept-encoding");
    expect(varyOnEncoding("cookie")).toBe("cookie, accept-encoding");
    expect(varyOnEncoding("Accept-Encoding")).toBe("Accept-Encoding");
  });
});

/** An HTML response. */
const html = (body: BodyInit, init: ResponseInit = {}) =>
  new Response(body, {
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });

describe("compressResponse", () => {
  it("compresses text bodies with the negotiated encoding", async () => {
    const text = "<p>hello</p>".repeat(500);
    const br = compressResponse(html(text), "br", "GET");
    expect(br.headers.get("content-encoding")).toBe("br");
    expect(br.headers.get("vary")).toBe("accept-encoding");
    expect(brotliDecompressSync(Buffer.from(await br.arrayBuffer())).toString()).toBe(text);
    const gz = compressResponse(html(text), "gzip", "GET");
    expect(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString()).toBe(text);
  });

  it("leaves small, binary, encoded, HEAD and body-less responses alone", () => {
    const small = html("<p>hi</p>", { headers: { "content-length": "9" } });
    expect(compressResponse(small, "br", "GET")).toBe(small);
    expect(small.headers.get("vary")).toBe("accept-encoding");
    const png = new Response("x".repeat(2000), { headers: { "content-type": "image/png" } });
    expect(compressResponse(png, "br", "GET").headers.get("content-encoding")).toBeNull();
    const encoded = html("x".repeat(2000), { headers: { "content-encoding": "gzip" } });
    expect(compressResponse(encoded, "br", "GET")).toBe(encoded);
    expect(
      compressResponse(html("x".repeat(2000)), "br", "HEAD").headers.get("content-encoding"),
    ).toBeNull();
    expect(compressResponse(html("x".repeat(2000)), undefined, "GET").headers.get("vary")).toBe(
      "accept-encoding",
    );
    const redirect = Response.redirect("http://localhost/", 303);
    expect(compressResponse(redirect, "br", "GET")).toBe(redirect);
  });

  it(
    "keeps streamed HTML streaming: each pause flushes what the app sent",
    { timeout: 5000 },
    async () => {
      let release!: () => void;
      const paused = new Promise<void>((resolve) => (release = resolve));
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode("<html><body><p>shell</p>"));
          await paused;
          controller.enqueue(encoder.encode("<p>streamed</p></body></html>"));
          controller.close();
        },
      });
      const response = compressResponse(html(body), "br", "GET");
      const decoder = createBrotliDecompress();
      let decoded = "";
      decoder.on("data", (chunk: Buffer) => (decoded += chunk.toString()));
      const reader = response.body!.getReader();
      // The shell arrives before the rest of the body exists.
      while (!decoded.includes("shell")) {
        const { value } = await reader.read();
        decoder.write(value);
        // Decompression is asynchronous: let it catch up before reading again.
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(decoded).not.toContain("streamed");
      release();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        decoder.write(value);
      }
      await new Promise((resolve) => decoder.end(resolve));
      expect(decoded).toBe("<html><body><p>shell</p><p>streamed</p></body></html>");
    },
  );
});

describe("precompressed static files", () => {
  let dir: string;
  const servers: Server[] = [];

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "lumen-compress-"));
    const files: Record<string, string | Buffer> = {
      "assets/app-abc.js": BIG_JS,
      "assets/app-abc.js.br": brotliCompressSync(BIG_JS),
      "assets/app-abc.js.gz": gzipSync(BIG_JS),
      "assets/only-gz.js": BIG_JS,
      "assets/only-gz.js.gz": gzipSync(BIG_JS),
      "assets/plain.js": "console.log(1)",
    };
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), content);
    }
  });

  afterAll(() => {
    for (const server of servers) server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function serve(compress?: boolean) {
    const statics = createStaticHandler(
      dir,
      { base: "/", trailingSlash: "ignore", assetsDir: "assets" },
      compress === undefined ? {} : { compress },
    );
    const server = createServer((req, res) => {
      void statics(req, res).then((served) => {
        if (!served) res.writeHead(418).end();
      });
    });
    servers.push(server);
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const port = (server.address() as AddressInfo).port;
    // Raw requests: fetch would decode the body and hide what the server sent.
    return (path: string, acceptEncoding?: string) =>
      new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>(
        (resolve, reject) => {
          const req = request(
            {
              port,
              host: "127.0.0.1",
              path,
              headers: acceptEncoding ? { "accept-encoding": acceptEncoding } : {},
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on("data", (chunk: Buffer) => chunks.push(chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode!,
                  headers: res.headers,
                  body: Buffer.concat(chunks),
                }),
              );
            },
          );
          req.on("error", reject);
          req.end();
        },
      );
  }

  it("serves the .br or .gz copy the client accepts, with Vary", async () => {
    const get = await serve();
    const br = await get("/assets/app-abc.js", "gzip, br");
    expect(br.headers["content-encoding"]).toBe("br");
    expect(br.headers.vary).toBe("accept-encoding");
    expect(br.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(brotliDecompressSync(br.body).toString()).toBe(BIG_JS);
    const gz = await get("/assets/app-abc.js", "gzip");
    expect(gz.headers["content-encoding"]).toBe("gzip");
    expect(gunzipSync(gz.body).toString()).toBe(BIG_JS);
    expect(br.headers.etag).not.toBe(gz.headers.etag);

    const fallback = await get("/assets/only-gz.js", "br, gzip");
    expect(fallback.headers["content-encoding"]).toBe("gzip");
    const identity = await get("/assets/app-abc.js");
    expect(identity.headers["content-encoding"]).toBeUndefined();
    expect(identity.headers.vary).toBe("accept-encoding");
    expect(identity.body.toString()).toBe(BIG_JS);
    const plain = await get("/assets/plain.js", "br");
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(plain.headers.vary).toBeUndefined();
  });

  it("serves the original file with compress: false", async () => {
    const get = await serve(false);
    const response = await get("/assets/app-abc.js", "br, gzip");
    expect(response.headers["content-encoding"]).toBeUndefined();
    expect(response.body.toString()).toBe(BIG_JS);
  });
});
