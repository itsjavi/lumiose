import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { sendWebResponse, toWebRequest } from "./node-http.ts";

let server: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined));
  server = undefined;
});

/** Serves `handle` through the bridge and returns the base URL. */
async function serve(handle: (request: Request) => Response | Promise<Response>): Promise<string> {
  server = createServer((req, res) => {
    void (async () => sendWebResponse(res, await handle(toWebRequest(req, res))))();
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("toWebRequest / sendWebResponse", () => {
  it("bridges method, URL, headers and a streamed body", async () => {
    const base = await serve(async (request) =>
      Response.json({
        method: request.method,
        url: request.url,
        custom: request.headers.get("x-custom"),
        body: await request.text(),
      }),
    );
    const response = await fetch(`${base}/echo?x=1`, {
      method: "POST",
      headers: { "x-custom": "yes" },
      body: "hello",
    });
    expect(await response.json()).toEqual({
      method: "POST",
      url: `${base}/echo?x=1`,
      custom: "yes",
      body: "hello",
    });
  });

  it("writes status, headers and each set-cookie separately", async () => {
    const base = await serve(() => {
      const headers = new Headers({ "content-type": "text/plain", "x-extra": "1" });
      headers.append("set-cookie", "a=1; Path=/");
      headers.append("set-cookie", "b=2; Path=/");
      return new Response("created", { status: 201, headers });
    });
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-extra")).toBe("1");
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect(await response.text()).toBe("created");
  });

  it("flushes streamed chunks as they come", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const encoder = new TextEncoder();
    const base = await serve(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode("shell"));
              await gate;
              controller.enqueue(encoder.encode("+boundary"));
              controller.close();
            },
          }),
        ),
    );
    const reader = (await fetch(`${base}/`)).body!.getReader();
    const decoder = new TextDecoder();
    expect(decoder.decode((await reader.read()).value)).toBe("shell");
    release();
    expect(decoder.decode((await reader.read()).value)).toBe("+boundary");
    expect((await reader.read()).done).toBe(true);
  });

  it("aborts the request signal and cancels the body when the client disconnects", async () => {
    let aborted!: () => void;
    const abortedSignal = new Promise<void>((resolve) => (aborted = resolve));
    let cancelled!: () => void;
    const cancelledBody = new Promise<void>((resolve) => (cancelled = resolve));
    const base = await serve((request) => {
      request.signal.addEventListener("abort", () => aborted());
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("start"));
          },
          cancel() {
            cancelled();
          },
        }),
      );
    });
    const controller = new AbortController();
    const response = await fetch(`${base}/`, { signal: controller.signal });
    await response.body!.getReader().read();
    controller.abort();
    await Promise.all([abortedSignal, cancelledBody]);
  });
});
