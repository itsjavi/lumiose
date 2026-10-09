// Request targets (TASK-164): `POST //attacker.test/account` must not make the request's host
// attacker.test, which would pass the cross-site form check and poison url() and fetchJSON's
// same-origin test. Raw sockets, since fetch() never sends such targets.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { url } from "./scope.ts";
import { app } from "./__fixtures__/app.ts";
import { BadRequestTarget, sendWebResponse, toWebRequest } from "./node-http.ts";

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
        if (!(error instanceof BadRequestTarget)) throw error;
        res.writeHead(400).end();
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
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(
        `${head}\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
      );
    });
    let out = "";
    socket.on("data", (chunk) => (out += chunk));
    socket.on("error", reject);
    socket.on("end", () => {
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
