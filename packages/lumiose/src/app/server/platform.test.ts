// `ctx.platform` (decision-45, TASK-248): what the host passes with `fetch(request, platform)`,
// with fallbacks. Middleware-only apps: the context is the one routes get too.
import { describe, expect, it } from "vitest";
import type { Middleware, RequestContext } from "./context.ts";
import { getRequestScope } from "./scope.ts";
import { app } from "./__fixtures__/app.ts";

const seen: RequestContext["platform"][] = [];

const recordPlatform: Middleware = (ctx) => {
  seen.push(ctx.platform);
  return Response.json({
    clientAddress: ctx.platform.clientAddress ?? null,
    env: ctx.platform.env,
  });
};

describe("ctx.platform", () => {
  it("falls back when the host passes nothing: no bindings, no client address", async () => {
    const { fetch } = app({ "src/middleware.ts": { default: recordPlatform } });
    const res = await fetch("/anything");
    expect(await res.json()).toEqual({ clientAddress: null, env: {} });
  });

  it("carries what the host passes", async () => {
    const { handle } = app({ "src/middleware.ts": { default: recordPlatform } });
    const kept: Promise<unknown>[] = [];
    const env = { DB: { name: "d1" } };
    const res = await handle(new Request("https://lumiose.test/"), {
      env: env as never,
      clientAddress: "203.0.113.7",
      waitUntil: (promise) => void kept.push(promise),
    });
    expect(await res.json()).toEqual({ clientAddress: "203.0.113.7", env });
    const work = Promise.resolve("later");
    seen.at(-1)!.waitUntil(work);
    expect(kept).toEqual([work]);
  });

  it("runs waitUntil work without a host and reports its failure to onError", async () => {
    const failure = new Error("background failed");
    const { fetch, onError } = app({
      "src/middleware.ts": {
        default: ((ctx) => {
          ctx.platform.waitUntil(Promise.reject(failure));
          return new Response("sent");
        }) as Middleware,
      },
    });
    const res = await fetch("/");
    expect(await res.text()).toBe("sent");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).toHaveBeenCalledWith(failure, expect.any(Request));
  });

  it("is shared by in-process requests (fetchJSON during SSR)", async () => {
    const addresses: (string | undefined)[] = [];
    const { handle } = app({
      "src/middleware.ts": {
        default: (async (ctx) => {
          addresses.push(ctx.platform.clientAddress);
          if (ctx.url.pathname === "/inner") return new Response("inner");
          const inner = await getRequestScope()!.fetch!(new Request(new URL("/inner", ctx.url)));
          return new Response(`outer ${await inner.text()}`);
        }) as Middleware,
      },
    });
    const res = await handle(new Request("https://lumiose.test/"), { clientAddress: "::1" });
    expect(await res.text()).toBe("outer inner");
    expect(addresses).toEqual(["::1", "::1"]);
  });
});
