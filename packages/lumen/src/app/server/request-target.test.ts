// Request targets (TASK-164): `POST //attacker.test/account` must not make the request's host
// attacker.test, which would pass the cross-site form check and poison url() and fetchJSON's
// same-origin test. Raw sockets, since fetch() never sends such targets.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { pathBelowBase } from "../headers.ts";
import { DEFAULT_LIMITS } from "./body.ts";
import { redirect } from "./control.ts";
import { url } from "./scope.ts";
import { app } from "./__fixtures__/app.ts";
import { RejectedRequest, sendWebResponse, toWebRequest } from "./node-http.ts";

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

/** Serves `handle` through the bridge (with `origin`); bad targets answer 400. */
async function serve(
  handle: (request: Request) => Response | Promise<Response>,
  origin?: string,
): Promise<number> {
  server = createServer((req, res) => {
    void (async () => {
      let request: Request;
      try {
        request = toWebRequest(req, res, origin);
      } catch (error) {
        if (!(error instanceof RejectedRequest)) throw error;
        res.writeHead(error.status).end();
        return;
      }
      await sendWebResponse(res, await handle(request));
    })();
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

/** Sends a raw HTTP/1.1 request; resolves to the status and the (unchunked) body. */
function raw(port: number, head: string, body = ""): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(
        `${head}\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
      );
    });
    let out = "";
    socket.on("data", (chunk) => (out += chunk));
    // A server that answers early (413) may close while the body is still being written.
    socket.on("error", () => {});
    socket.on("close", () => {
      const split = out.indexOf("\r\n\r\n");
      let rest = out.slice(split + 4);
      if (/^transfer-encoding: chunked$/im.test(out.slice(0, split))) {
        let text = "";
        for (;;) {
          const eol = rest.indexOf("\r\n");
          const size = Number.parseInt(rest.slice(0, eol), 16);
          if (!size) break;
          text += rest.slice(eol + 2, eol + 2 + size);
          rest = rest.slice(eol + 2 + size + 2);
        }
        rest = text;
      }
      resolve({ status: Number(out.split(" ")[1]), body: rest });
    });
  });
}

describe("request targets", () => {
  it("keeps //host in the path: the request URL stays on the server's origin", async () => {
    const port = await serve((request) => new Response(request.url), "https://victim.test");
    const echoed = await raw(port, "GET //attacker.test/account?x=1 HTTP/1.1\r\nHost: victim.test");
    expect(echoed.body).toBe("https://victim.test//attacker.test/account?x=1");
    // Without ORIGIN: the Host header's origin, never the target's.
    const derived = await serve((request) => new Response(request.url));
    const local = await raw(derived, "GET //attacker.test/x HTTP/1.1\r\nHost: app.test:8080");
    expect(local.body).toBe("http://app.test:8080//attacker.test/x");
  });

  it("rejects absolute-form and other targets; accepts OPTIONS *", async () => {
    const port = await serve((request) => new Response(new URL(request.url).pathname));
    expect((await raw(port, "GET http://attacker.test/x HTTP/1.1\r\nHost: a.test")).status).toBe(
      400,
    );
    expect((await raw(port, "GET * HTTP/1.1\r\nHost: a.test")).status).toBe(400);
    const options = await raw(port, "OPTIONS * HTTP/1.1\r\nHost: a.test");
    expect(options).toEqual({ status: 200, body: "/" });
    expect((await raw(port, "GET / HTTP/1.1\r\nHost: a b")).status).toBe(400);
  });

  it("keeps the cross-site form check and url() on the real origin", async () => {
    let ran = 0;
    const { handle } = app({
      "src/routes/account.stsx": {
        default: () => `<p>${url().host}${url().pathname}</p>`,
        action: () => {
          ran++;
          return { done: true };
        },
      },
      "src/routes/[...rest].stsx": { default: () => `<p>${url().host} ${url().pathname}</p>` },
    });
    const port = await serve(handle, "https://victim.test");
    const form = "Content-Type: application/x-www-form-urlencoded";
    const posted = await raw(
      port,
      `POST //attacker.test/account HTTP/1.1\r\nHost: victim.test\r\nOrigin: https://attacker.test\r\n${form}`,
      "a=1",
    );
    expect(posted.status).not.toBe(200);
    expect(ran).toBe(0);
    const page = await raw(port, "GET //attacker.test/reset HTTP/1.1\r\nHost: victim.test");
    expect(page.body).toContain("victim.test //attacker.test/reset");
    expect(page.body).not.toContain("<p>attacker.test");
  });
});

/**
 * Sends a raw keep-alive request with a chunked body of `size` bytes, in 64 kB chunks, and resolves
 * to the response status as soon as it arrives (the server may answer before the body ends).
 */
function rawChunked(port: number, head: string, size: number): Promise<number> {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    const socket = connect(port, "127.0.0.1", async () => {
      socket.write(`${head}\r\nTransfer-Encoding: chunked\r\n\r\n`);
      const chunk = "a".repeat(64 * 1024);
      for (let sent = 0; sent < size; sent += chunk.length) {
        if (done) break;
        socket.write(`${chunk.length.toString(16)}\r\n${chunk}\r\n`);
        await new Promise((next) => setImmediate(next));
      }
      if (!done) socket.write("0\r\n\r\n");
    });
    socket.on("data", (data) => {
      out += data;
      if (!done && out.includes("\r\n")) {
        done = true;
        resolve(Number(out.split(" ")[1]));
        socket.destroy();
      }
    });
    socket.on("error", () => {});
  });
}

/** Sends only the head of a request declaring `length` bytes; resolves to the response status. */
function declaredOnly(port: number, head: string, length: number): Promise<number> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1", () =>
      socket.write(`${head}\r\nContent-Length: ${length}\r\nConnection: close\r\n\r\n`),
    );
    let out = "";
    socket.on("data", (data) => {
      out += data;
      if (out.includes("\r\n\r\n")) socket.destroy();
    });
    socket.on("error", () => {});
    socket.on("close", () => resolve(Number(out.split(" ")[1])));
  });
}

/** A raw POST head to an endpoint. */
const endpointHead = (path: string) =>
  `POST ${path} HTTP/1.1\r\nHost: victim.test\r\nContent-Type: application/octet-stream`;

/** A form action and an endpoint that reads its whole body. */
function actionApp() {
  const ran = { count: 0 };
  const { handle } = app({
    "src/routes/form.stsx": {
      default: () => "<p>form</p>",
      action: async (ctx: { formData(): Promise<FormData> }) => {
        await ctx.formData();
        ran.count++;
        return { ok: true };
      },
    },
    "src/routes/api/upload.ts": {
      mode: "server",
      POST: async (ctx: { request: Request }) =>
        new Response(String((await ctx.request.arrayBuffer()).byteLength)),
    },
    "src/routes/api/small.ts": {
      mode: "server",
      limits: { body: "2kb" },
      POST: async (ctx: { request: Request }) =>
        new Response(String((await ctx.request.arrayBuffer()).byteLength)),
    },
  });
  return { handle, ran };
}

// Bounded bodies and malformed requests (TASK-167 H1, L1, L3).
describe("request bodies and malformed requests", () => {
  const form = "Content-Type: application/x-www-form-urlencoded";

  it("refuses a form action body declared or streamed over the limit with 413", async () => {
    const { handle, ran } = actionApp();
    const port = await serve(handle, "http://victim.test");
    const head = `POST /form HTTP/1.1\r\nHost: victim.test\r\nOrigin: http://victim.test\r\n${form}`;
    expect(await declaredOnly(port, head, DEFAULT_LIMITS.body + 1)).toBe(413);
    expect(await rawChunked(port, head, DEFAULT_LIMITS.body + 64 * 1024)).toBe(413);
    expect(ran.count).toBe(0);
    expect((await raw(port, head, "a=1")).status).toBe(200);
    expect(ran.count).toBe(1);
  });

  it("bounds endpoint bodies too, with the route's own limits over the app's", async () => {
    const { handle } = actionApp();
    const port = await serve(handle, "http://victim.test");
    expect((await raw(port, endpointHead("/api/upload"), "x".repeat(1000))).body).toBe("1000");
    expect(
      await rawChunked(port, endpointHead("/api/upload"), DEFAULT_LIMITS.body + 64 * 1024),
    ).toBe(413);
    expect(await declaredOnly(port, endpointHead("/api/upload"), DEFAULT_LIMITS.body + 1)).toBe(
      413,
    );
    // `export const limits = { body: "2kb" }` on the route.
    expect((await raw(port, endpointHead("/api/small"), "x".repeat(2048))).body).toBe("2048");
    expect((await raw(port, endpointHead("/api/small"), "x".repeat(4096))).status).toBe(413);
    // Multipart bodies get the `upload` limit.
    const multipart = `POST /api/upload HTTP/1.1\r\nHost: victim.test\r\nContent-Type: multipart/form-data; boundary=x`;
    const upload = "x".repeat(DEFAULT_LIMITS.body + 1024);
    expect((await raw(port, multipart, upload)).body).toBe(String(upload.length));
    expect(await declaredOnly(port, multipart, DEFAULT_LIMITS.upload + 1)).toBe(413);
  });

  it("takes the app's limits from lumen({ limits })", async () => {
    const { handle } = app(
      {
        "src/routes/api/upload.ts": {
          mode: "server",
          POST: async (ctx: { request: Request }) =>
            new Response(String((await ctx.request.arrayBuffer()).byteLength)),
        },
      },
      { limits: { body: "1kb" } },
    );
    const port = await serve(handle, "http://victim.test");
    const head = "POST /api/upload HTTP/1.1\r\nHost: victim.test\r\nContent-Type: text/plain";
    expect((await raw(port, head, "x".repeat(1024))).body).toBe("1024");
    expect((await raw(port, head, "x".repeat(1025))).status).toBe(413);
  });

  it("answers forbidden methods with 405, not a server error", async () => {
    const port = await serve(() => new Response("app"));
    expect((await raw(port, "TRACE / HTTP/1.1\r\nHost: a.test")).status).toBe(405);
  });

  it("matches path-scoped header rules on the normalized pathname", () => {
    expect(pathBelowBase("/x/../admin/page?q=1", "/")).toBe("/admin/page");
    expect(pathBelowBase("/docs/x/%2e%2e/admin", "/docs/")).toBe("/admin");
  });
});

describe("trailing-slash redirects (TASK-165)", () => {
  it("never redirect to a protocol-relative URL", async () => {
    const pages = { "src/routes/[slug].stsx": { default: () => "<p>page</p>" } };
    const never = app(pages, { trailingSlash: "never" });
    const response = await never.handle(new Request("https://lumen.test//evil.com/"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("/evil.com");
    const always = app(pages, { trailingSlash: "always" });
    const added = await always.handle(new Request("https://lumen.test//evil.com"));
    expect(added.headers.get("location")).toBe("/evil.com/");
  });
});

describe("redirect() (TASK-165)", () => {
  it("accepts paths and http(s) URLs only", () => {
    for (const bad of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "java\tscript:x",
      "data:text/html,x",
    ]) {
      expect(() => redirect(bad), bad).toThrow(TypeError);
    }
    for (const good of ["/next", "next?x=1", "https://example.com/", "//example.com/a"]) {
      expect(() => redirect(good), good).toThrow(expect.objectContaining({ location: good }));
    }
  });
});
