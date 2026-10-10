import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchError, isFetchError } from "../fetch-json.ts";
import type { Middleware, RequestContext } from "./context.ts";
import { error, redirect } from "./control.ts";
import { fetchJSON } from "./fetch-json.ts";
import { cookies, locals } from "./scope.ts";
import { app, page, type Modules } from "./__fixtures__/app.ts";
import { $await, $leave, createComponent, renderToStream, ssr } from "../../server/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
const body = async (res: Response) => {
  const text = await res.text();
  return text.slice(text.indexOf("<body>") + 6, text.indexOf("</body>"));
};

describe("fetchJSON() during SSR", () => {
  const modules: Modules = {
    "src/middleware.ts": {
      default: ((ctx, next) => {
        const depth = (ctx.locals as { depth?: number }).depth;
        Object.assign(ctx.locals, { depth: depth === undefined ? 0 : depth + 1 });
        return next();
      }) satisfies Middleware,
    },
    "src/routes/_404.stsx": page((props) => `404 ${props.error.message}`),
    "src/routes/_error.stsx": page((props) => `${props.status} ${props.error.message}`),
    "src/routes/api/me.ts": {
      GET: (ctx: RequestContext) => {
        cookies().set("seen", "1");
        return json({
          user: ctx.cookies.get("user"),
          header: ctx.request.headers.get("cookie"),
          auth: ctx.request.headers.get("authorization"),
          depth: (ctx.locals as { depth: number }).depth,
          url: ctx.url.href,
        });
      },
    },
    "src/routes/api/missing.ts": {
      GET: () => json({ reason: "gone" }, { status: 404, statusText: "Not Found" }),
    },
    "src/routes/api/old.ts": { GET: () => redirect("/api/me") },
    "src/routes/api/loop.ts": { GET: () => fetchJSON("/api/loop").then(json) },
    "src/routes/api/fails.ts": { GET: () => error(503) },
    "src/routes/me.stsx": page(async () => JSON.stringify(await fetchJSON("api/me?x=1"))),
    "src/routes/old.stsx": page(async () => JSON.stringify(await fetchJSON("/api/old"))),
    "src/routes/missing.stsx": page(async () => {
      try {
        return await fetchJSON("/api/missing");
      } catch (caught) {
        if (!isFetchError(caught)) throw caught;
        return `${caught.status} ${caught.url} ${JSON.stringify(caught.data)}`;
      }
    }),
    "src/routes/fails.stsx": page(() => fetchJSON("/api/fails")),
    "src/routes/loop.stsx": page(() => fetchJSON("/api/loop")),
  };

  it("serves same-origin URLs in-process, as part of the page request", async () => {
    const network = vi.fn();
    vi.stubGlobal("fetch", network);
    const { fetch } = app(modules);
    const res = await fetch("/me", { headers: { cookie: "user=ada", authorization: "Bearer t" } });
    expect(network).not.toHaveBeenCalled();
    expect(JSON.parse(await body(res))).toEqual({
      user: "ada",
      header: "user=ada",
      auth: "Bearer t",
      // Middleware ran again, starting from a copy of the page's locals.
      depth: 1,
      // Relative URLs resolve against the page URL.
      url: "https://lumiose.test/api/me?x=1",
    });
    // Cookies the endpoint set go out with the page.
    expect(res.headers.getSetCookie()).toEqual([expect.stringMatching(/^seen=1;/)]);
  });

  it("does not leak locals written by the in-process request back to the page", async () => {
    const { fetch } = app({
      ...modules,
      "src/routes/me.stsx": page(async () => {
        await fetchJSON("/api/me");
        return String((locals() as { depth: number }).depth);
      }),
    });
    expect(await body(await fetch("/me"))).toBe("0");
  });

  it("sends request bodies in-process", async () => {
    const { fetch } = app({
      "src/routes/api/echo.ts": {
        POST: async (ctx: RequestContext) => json({ got: await ctx.request.json() }),
      },
      "src/routes/index.stsx": page(async () =>
        JSON.stringify(
          await fetchJSON("/api/echo", {
            method: "POST",
            body: JSON.stringify({ a: 1 }),
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    });
    expect(await body(await fetch("/"))).toBe('{"got":{"a":1}}');
  });

  it("follows same-origin redirects in-process", async () => {
    const { fetch } = app(modules);
    expect(JSON.parse(await body(await fetch("/old")))).toMatchObject({
      url: "https://lumiose.test/api/me",
    });
  });

  it("throws a FetchError with the status and body for non-2xx responses", async () => {
    const { fetch } = app(modules);
    expect(await body(await fetch("/missing"))).toBe(
      '404 https://lumiose.test/api/missing {"reason":"gone"}',
    );
    // Escaping a server component, it renders the error page with its status.
    const failed = await fetch("/fails");
    expect(failed.status).toBe(503);
    expect(await body(failed)).toBe("503 Service Unavailable");
  });

  it("stops in-process fetch loops", async () => {
    const { fetch, onError } = app(modules);
    expect((await fetch("/loop")).status).toBe(500);
    expect(onError.mock.calls[0]![0].message).toMatch(/nested more than 8 levels deep/);
  });

  it("uses the network for other origins", async () => {
    const network = vi.fn(async (request: Request) =>
      json({ url: request.url, accept: request.headers.get("accept") }),
    );
    vi.stubGlobal("fetch", network);
    const { fetch } = app({
      "src/routes/index.stsx": page(async () =>
        JSON.stringify(await fetchJSON("https://api.example.com/x")),
      ),
    });
    expect(JSON.parse(await body(await fetch("/")))).toEqual({
      url: "https://api.example.com/x",
      accept: "application/json",
    });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("needs an absolute URL outside a request", async () => {
    await expect(fetchJSON("/api/x")).rejects.toThrow(/relative URLs need a current request/);
    const network = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", network);
    await expect(fetchJSON("https://api.example.com/x")).resolves.toBeUndefined();
  });

  it("reports responses that are not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("<html>", { headers: { "content-type": "text/html" } }),
    );
    await expect(fetchJSON("https://api.example.com/x")).rejects.toThrow(
      "fetchJSON(https://api.example.com/x): the response is not JSON (content-type: text/html).",
    );
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    const failure = await fetchJSON("https://api.example.com/x").catch((caught) => caught);
    expect(failure).toBeInstanceOf(FetchError);
    expect(failure).toMatchObject({ status: 500, message: "Internal Server Error", data: "nope" });
  });
});

async function Slow() {
  try {
    (await $await(() => fetchJSON("https://api.example.com/slow"), 0))();
    return ssr(["never"]);
  } finally {
    $leave();
  }
}

describe("fetchJSON() signal during SSR", () => {
  it("defaults to the render's lifetime inside async components, so an aborted render cancels it", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", (request: Request) => {
      requests.push(request);
      return new Promise<Response>(() => {});
    });
    void fetchJSON("https://api.example.com/outside");
    const controller = new AbortController();
    const shell = renderToStream(() => createComponent(Slow, {}), { signal: controller.signal });
    expect(requests.map((request) => request.url)).toEqual([
      "https://api.example.com/outside",
      "https://api.example.com/slow",
    ]);
    expect(requests[1]!.signal.aborted).toBe(false);
    controller.abort(new Error("client gone"));
    await expect(shell).rejects.toThrow("client gone");
    expect(requests.map((request) => request.signal.aborted)).toEqual([false, true]);
  });
});
