import { describe, expect, it, vi } from "vitest";
import { error, notFound, redirect } from "./control.ts";
import type { Endpoint, ErrorPageProps, Middleware, RequestContext } from "./context.ts";
import { createRequestHandler, type ModuleExports } from "./handler.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { cookies, env, locals, params, request, response, signedCookie, url } from "./scope.ts";
import { app, layout, page, type Modules, type Props } from "./__fixtures__/app.ts";
import {
  createStringRenderer,
  resolve as resolveFixture,
  testDefer,
  testHead,
} from "./__fixtures__/string-renderer.ts";

const errorPage = (name: string): ModuleExports =>
  page((props: ErrorPageProps) => `<p>${name} ${props.status} ${props.error.message}</p>`);

const Document = async ({ head, body }: Props) => ({
  t: `<html lang="es" data-path="${url().pathname}"><head>${head.t}</head><body class="app">${await resolveFixture(body)}</body></html>`,
});

const DOCUMENT_START =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

describe("pages", () => {
  it("renders the page through its layouts, outermost first, inside the default document", async () => {
    const seen: unknown[] = [];
    const { fetch } = app({
      "src/routes/_layout.stsx": page(async (props) => {
        seen.push(["root", props.params]);
        return `<div id="root">${await props.children}</div>`;
      }),
      "src/routes/blog/_layout.stsx": layout("section"),
      "src/routes/blog/[slug].stsx": page((props) => `<h1>${props.params.slug}</h1>`),
    });
    const res = await fetch("/blog/hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await res.text()).toBe(
      `${DOCUMENT_START}</head><body><div id="root"><section><h1>hello</h1></section></div></body></html>`,
    );
    expect(seen).toEqual([["root", { slug: "hello" }]]);
  });

  it("puts collected head and head assets into the default document", async () => {
    const headAssets = vi.fn(
      (files: readonly string[]) => `<link rel="stylesheet" href="/${files.length}.css">`,
    );
    const { fetch } = app(
      {
        "src/routes/_layout.stsx": layout("main"),
        "src/routes/index.stsx": page(() => `${testHead("<title>Home</title>")}<h1>Home</h1>`),
      },
      { headAssets },
    );
    const html = await (await fetch("/")).text();
    expect(html).toBe(
      `${DOCUMENT_START}<title>Home</title><link rel="stylesheet" href="/2.css"></head><body><main><h1>Home</h1></main></body></html>`,
    );
    expect(headAssets).toHaveBeenCalledWith(
      ["src/routes/_layout.stsx", "src/routes/index.stsx"],
      false,
    );
  });

  it("renders a custom src/document.stsx with { head, body } and adds the doctype", async () => {
    const { fetch } = app(
      {
        "src/document.stsx": { default: Document },
        "src/routes/index.stsx": page(() => `${testHead("<title>Hola</title>")}<h1>Hola</h1>`),
      },
      { document: "src/document.stsx" },
    );
    expect(await (await fetch("/")).text()).toBe(
      '<!doctype html><html lang="es" data-path="/"><head><title>Hola</title></head><body class="app"><h1>Hola</h1></body></html>',
    );
  });

  it("reports a custom document that does not render the body", async () => {
    const { fetch, onError } = app(
      {
        "src/document.stsx": page(() => ({ t: "<html><body></body></html>" })),
        "src/routes/index.stsx": page(() => "<h1>x</h1>"),
      },
      { document: "src/document.stsx" },
    );
    const res = await fetch("/");
    expect(res.status).toBe(500);
    expect(onError.mock.calls[0]![0].message).toMatch(/must render \{props.body\}/);
  });

  it("gives server components request-scoped accessors, also after awaits", async () => {
    const { fetch } = app(
      {
        "src/middleware.ts": {
          default: ((ctx, next) => {
            Object.assign(ctx.locals, { user: "ada" });
            return next();
          }) satisfies Middleware,
        },
        "src/routes/users/[id].stsx": page(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          const local = locals() as { user: string };
          return [
            request().method,
            url().search,
            params<never>().id,
            local.user,
            cookies().get("theme"),
            env("APP_NAME"),
          ].join("|");
        }),
      },
      { env: { APP_NAME: "demo" } },
    );
    const res = await fetch("/users/7?tab=1", { headers: { cookie: "theme=dark" } });
    expect(await res.text()).toContain("<body>GET|?tab=1|7|ada|dark|demo</body>");
  });

  it("applies response().setStatus/setHeader and the page headers export", async () => {
    const { fetch } = app({
      "src/routes/gone.stsx": {
        default: () => {
          response().setStatus(410);
          response().setHeader("x-page", "1");
          return "<p>gone</p>";
        },
        headers: (ctx: RequestContext) => ({
          "cache-control": `max-age=${ctx.url.searchParams.get("age")}`,
        }),
      },
    });
    const res = await fetch("/gone?age=60");
    expect(res.status).toBe(410);
    expect(res.headers.get("x-page")).toBe("1");
    expect(res.headers.get("cache-control")).toBe("max-age=60");
  });

  it("streams Suspense chunks after the shell, inside <body>", async () => {
    const { fetch } = app({
      "src/routes/index.stsx": page(() => `<h1>shell</h1>${testDefer(async () => "<p>late</p>")}`),
    });
    const res = await fetch("/");
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(await res.text()).toBe(
      `${DOCUMENT_START}</head><body><h1>shell</h1><!--defer:0--><template for="defer:0"><p>late</p></template></body></html>`,
    );
  });

  it("renders fully resolved when prerendering", async () => {
    const { fetch } = app(
      {
        "src/routes/index.stsx": page(() => `<h1>a</h1>${testDefer(async () => "<p>b</p>")}`),
      },
      { prerender: true },
    );
    expect(await (await fetch("/")).text()).toContain("<body><h1>a</h1><p>b</p></body>");
  });

  it("rejects status, header and cookie writes after the shell was sent (LUM5004)", async () => {
    const writes: Array<() => void> = [
      () => response().setStatus(500),
      () => response().setHeader("x-late", "1"),
      () => cookies().set("late", "1"),
    ];
    for (const write of writes) {
      const gate = Promise.withResolvers<void>();
      const { fetch, onError } = app({
        "src/routes/index.stsx": page(
          () =>
            `<h1>shell</h1>${testDefer(async () => {
              await gate.promise;
              write();
              return "<p>unreachable</p>";
            })}`,
        ),
      });
      const res = await fetch("/");
      gate.resolve();
      expect(res.status).toBe(200);
      // The failed boundary ends the stream, but the document is still closed.
      expect(await res.text()).toBe(
        `${DOCUMENT_START}</head><body><h1>shell</h1><!--defer:0--></body></html>`,
      );
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]).toMatchObject({ code: "LUM5004" });
    }
  });

  it("answers HEAD without a body, OPTIONS with Allow, and other methods with 405", async () => {
    const { fetch } = app({ "src/routes/index.stsx": page(() => "<h1>x</h1>") });
    const head = await fetch("/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await head.text()).toBe("");

    const options = await fetch("/", { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("GET, HEAD, OPTIONS");

    const post = await fetch("/", { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
  });
});

describe("middleware", () => {
  it("runs the chain in order around pages and endpoints, sharing locals", async () => {
    const log: string[] = [];
    const tracer =
      (name: string): Middleware =>
      async (ctx, next) => {
        log.push(`${name}:before`);
        (ctx.locals as { trail?: string[] }).trail ??= [];
        (ctx.locals as { trail: string[] }).trail.push(name);
        const res = await next();
        log.push(`${name}:after`);
        return res;
      };
    const { fetch } = app({
      "src/middleware.ts": { default: [tracer("a"), tracer("b")] },
      "src/routes/index.stsx": page(() => {
        log.push("page");
        return (locals() as { trail: string[] }).trail.join(",");
      }),
      "src/routes/api.ts": {
        GET: ((ctx) => {
          log.push("endpoint");
          return Response.json(ctx.locals);
        }) satisfies Endpoint,
      },
    });
    expect(await (await fetch("/")).text()).toContain("<body>a,b</body>");
    expect(log).toEqual(["a:before", "b:before", "page", "b:after", "a:after"]);
    log.length = 0;
    expect(await (await fetch("/api")).json()).toEqual({ trail: ["a", "b"] });
    expect(log).toEqual(["a:before", "b:before", "endpoint", "b:after", "a:after"]);
  });

  it("can short-circuit, rewrite the response, and runs for unmatched URLs", async () => {
    const { fetch } = app({
      "src/middleware.ts": {
        default: (async (ctx, next) => {
          if (ctx.url.pathname.startsWith("/admin")) {
            ctx.cookies.set("seen", "1");
            return new Response("denied", { status: 401 });
          }
          const res = await next();
          res.headers.set("x-mw", String(res.status));
          return res;
        }) satisfies Middleware,
      },
      "src/routes/index.stsx": page(() => "<h1>x</h1>"),
      "src/routes/admin/index.stsx": page(() => "<h1>admin</h1>"),
    });
    const denied = await fetch("/admin");
    expect(denied.status).toBe(401);
    expect(await denied.text()).toBe("denied");
    expect(denied.headers.get("set-cookie")).toBe("seen=1; Path=/; HttpOnly; Secure; SameSite=Lax");
    expect((await fetch("/")).headers.get("x-mw")).toBe("200");
    expect((await fetch("/missing")).headers.get("x-mw")).toBe("404");
  });

  it("handles redirect() and error() thrown by middleware", async () => {
    const { fetch } = app({
      "src/middleware.ts": {
        default: ((ctx, next) => {
          if (ctx.url.pathname === "/old") redirect("/new", 308);
          if (ctx.url.pathname === "/private") error(403, "Members only");
          if (ctx.url.pathname === "/api/private") error(403, "Members only");
          return next();
        }) satisfies Middleware,
      },
      "src/routes/_error.stsx": errorPage("error"),
      "src/routes/private.stsx": page(() => "<h1>secret</h1>"),
      "src/routes/api/private.ts": { GET: () => new Response("secret") },
    });
    const moved = await fetch("/old");
    expect(moved.status).toBe(308);
    expect(moved.headers.get("location")).toBe("/new");
    const page403 = await fetch("/private");
    expect(page403.status).toBe(403);
    expect(await page403.text()).toContain("<p>error 403 Members only</p>");
    const api403 = await fetch("/api/private");
    expect(api403.status).toBe(403);
    expect(await api403.text()).toBe("Members only");
  });

  it("turns a middleware that returns no Response, or calls next() twice, into a 500", async () => {
    for (const middleware of [
      (() => undefined) as unknown as Middleware,
      (async (_ctx, next) => {
        await next();
        return next();
      }) satisfies Middleware,
    ]) {
      const { fetch, onError } = app({
        "src/middleware.ts": { default: middleware },
        "src/routes/index.stsx": page(() => "<h1>x</h1>"),
      });
      const res = await fetch("/");
      expect(res.status).toBe(500);
      expect(onError).toHaveBeenCalledTimes(1);
    }
  });
});

describe("endpoints", () => {
  const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

  it("calls the export for every method with the request context", async () => {
    const handlers = Object.fromEntries(
      METHODS.map((method) => [
        method,
        ((ctx) =>
          Response.json({ method: ctx.request.method, id: ctx.params.id })) satisfies Endpoint,
      ]),
    );
    const { fetch } = app({ "src/routes/api/items/[id].ts": handlers });
    for (const method of METHODS) {
      const res = await fetch("/api/items/7", { method });
      expect(await res.json()).toEqual({ method, id: "7" });
    }
  });

  it("answers missing methods with 405 and Allow, OPTIONS with 204, HEAD via GET", async () => {
    const { fetch } = app({
      "src/routes/api/posts.ts": {
        GET: () => new Response("list", { headers: { "x-count": "2" } }),
        POST: () => new Response("created", { status: 201 }),
      },
    });
    const del = await fetch("/api/posts", { method: "DELETE" });
    expect(del.status).toBe(405);
    expect(del.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
    const options = await fetch("/api/posts", { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
    const head = await fetch("/api/posts", { method: "HEAD" });
    expect(head.headers.get("x-count")).toBe("2");
    expect(await head.text()).toBe("");
  });

  it("maps thrown control flow and failures to responses", async () => {
    const { fetch, onError } = app({
      "src/routes/api/bad.ts": { GET: () => error(400, "Bad id") },
      "src/routes/api/move.ts": { GET: () => redirect("/x"), POST: () => redirect("/y") },
      "src/routes/api/boom.ts": {
        GET: () => {
          throw new Error("db down");
        },
      },
      "src/routes/api/nothing.ts": { GET: () => "nope" },
    });
    const bad = await fetch("/api/bad");
    expect([bad.status, await bad.text()]).toEqual([400, "Bad id"]);
    expect((await fetch("/api/move")).status).toBe(302);
    const posted = await fetch("/api/move", { method: "POST" });
    expect([posted.status, posted.headers.get("location")]).toEqual([303, "/y"]);
    const boom = await fetch("/api/boom");
    expect([boom.status, await boom.text()]).toEqual([500, "Internal Server Error"]);
    expect((await fetch("/api/nothing")).status).toBe(500);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("shows the error in dev and keeps middleware headers the endpoint did not set", async () => {
    const { fetch } = app(
      {
        "src/middleware.ts": {
          default: ((_ctx, next) => {
            response().setHeader("x-frame-options", "DENY");
            response().setHeader("cache-control", "no-store");
            return next();
          }) satisfies Middleware,
        },
        "src/routes/api/boom.ts": {
          GET: () => {
            throw new Error("db down");
          },
        },
        "src/routes/api/ok.ts": {
          GET: () => new Response("ok", { headers: { "cache-control": "max-age=60" } }),
        },
      },
      { dev: true },
    );
    expect(await (await fetch("/api/boom")).text()).toMatch(/^Error: db down/);
    const ok = await fetch("/api/ok");
    expect(ok.headers.get("x-frame-options")).toBe("DENY");
    expect(ok.headers.get("cache-control")).toBe("max-age=60");
  });
});

describe("redirects", () => {
  it("uses 302 for GET, 303 for other methods, and an explicit status when given", async () => {
    const { fetch } = app({
      "src/routes/login.stsx": page(() => redirect(new URL("https://lumiose.test/home"))),
      "src/routes/temp.stsx": page(() => redirect("/café?q=a b", 307)),
      "src/routes/api/session.ts": {
        DELETE: (ctx: RequestContext) => {
          ctx.cookies.delete("session");
          return redirect("/");
        },
      },
    });
    const login = await fetch("/login");
    expect([login.status, login.headers.get("location")]).toEqual([
      302,
      "https://lumiose.test/home",
    ]);
    const temp = await fetch("/temp");
    expect([temp.status, temp.headers.get("location")]).toEqual([307, "/caf%C3%A9?q=a%20b"]);
    const logout = await fetch("/api/session", { method: "DELETE" });
    expect(logout.status).toBe(303);
    expect(logout.headers.get("set-cookie")).toBe(
      "session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax",
    );
  });

  it("rejects invalid statuses", () => {
    expect(() => redirect("/", 200 as never)).toThrow(RangeError);
    expect(() => error(302)).toThrow(RangeError);
  });
});

describe("error pages", () => {
  const tree: Modules = {
    "src/routes/_layout.stsx": layout("main"),
    "src/routes/_404.stsx": errorPage("root-404"),
    "src/routes/_error.stsx": errorPage("root-error"),
    "src/routes/index.stsx": page(() => "<h1>home</h1>"),
    "src/routes/blog/_layout.stsx": layout("section"),
    "src/routes/blog/_404.stsx": errorPage("blog-404"),
    "src/routes/blog/[slug].stsx": page(({ params: { slug } }) => {
      if (slug === "missing") notFound();
      if (slug === "secret") error(403, "Forbidden post");
      if (slug === "boom") throw new Error("db down");
      return `<h1>${slug}</h1>`;
    }),
  };

  it("renders the _404 covering an unmatched URL, inside its layouts", async () => {
    const { fetch } = app(tree);
    const root = await fetch("/nope");
    expect(root.status).toBe(404);
    expect(await root.text()).toContain("<body><main><p>root-404 404 Not Found</p></main></body>");
    const blog = await fetch("/blog/a/b");
    expect(blog.status).toBe(404);
    expect(await blog.text()).toContain(
      "<body><main><section><p>blog-404 404 Not Found</p></section></main></body>",
    );
  });

  it("renders the page's nearest _404 for notFound() and _error for error()", async () => {
    const { fetch, onError } = app(tree);
    const missing = await fetch("/blog/missing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("<section><p>blog-404 404 Not Found</p></section>");
    const secret = await fetch("/blog/secret");
    expect(secret.status).toBe(403);
    expect(await secret.text()).toContain("<main><p>root-error 403 Forbidden post</p></main>");
    expect(onError).not.toHaveBeenCalled();
  });

  it("masks unexpected errors as 500 outside dev and reports them", async () => {
    const prod = app(tree);
    const res = await prod.fetch("/blog/boom");
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("<p>root-error 500 Internal Server Error</p>");
    expect(prod.onError.mock.calls[0]![0].message).toBe("db down");

    const dev = app(tree, { dev: true });
    expect(await (await dev.fetch("/blog/boom")).text()).toContain("<p>root-error 500 db down</p>");
  });

  it("falls back to _error for 404s without a _404, then to a built-in page", async () => {
    const withError = app({
      "src/routes/_error.stsx": errorPage("error"),
      "src/routes/index.stsx": page(() => "x"),
    });
    expect(await (await withError.fetch("/nope")).text()).toContain("<p>error 404 Not Found</p>");

    const bare = app({ "src/routes/index.stsx": page(() => error(418, "Teapot")) });
    const res = await bare.fetch("/");
    expect(res.status).toBe(418);
    expect(await res.text()).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>418 Error</title></head><body><h1>418 Error</h1><p>Teapot</p></body></html>',
    );
  });

  it("drops failing layouts, then failing error pages", async () => {
    const brokenLayout = app({
      "src/routes/_layout.stsx": page(() => {
        throw new Error("layout down");
      }),
      "src/routes/_error.stsx": errorPage("error"),
      "src/routes/index.stsx": page(() => "x"),
    });
    const res = await brokenLayout.fetch("/");
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("<body><p>error 500 Internal Server Error</p></body>");

    const brokenError = app({
      "src/routes/_error.stsx": page(() => {
        throw new Error("error page down");
      }),
      "src/routes/index.stsx": page(() => {
        throw new Error("page down");
      }),
    });
    const fallback = await brokenError.fetch("/");
    expect(fallback.status).toBe(500);
    expect(await fallback.text()).toContain("<h1>500 Internal Server Error</h1>");
    expect(brokenError.onError).toHaveBeenCalledTimes(2);
  });

  it("drops headers set by the failed page but keeps middleware headers and cookies", async () => {
    const { fetch } = app({
      "src/middleware.ts": {
        default: ((ctx, next) => {
          response().setHeader("x-mw", "1");
          ctx.cookies.set("visit", "1");
          return next();
        }) satisfies Middleware,
      },
      "src/routes/_error.stsx": errorPage("error"),
      "src/routes/index.stsx": page(() => {
        response().setHeader("cache-control", "max-age=600");
        error(503, "Maintenance");
      }),
    });
    const res = await fetch("/");
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBeNull();
    expect(res.headers.get("x-mw")).toBe("1");
    expect(res.headers.get("set-cookie")).toBe("visit=1; Path=/; HttpOnly; Secure; SameSite=Lax");
  });

  it("follows a redirect thrown by an error page", async () => {
    const { fetch } = app({
      "src/routes/_404.stsx": page(() => redirect("/")),
      "src/routes/index.stsx": page(() => "x"),
    });
    const res = await fetch("/nope");
    expect([res.status, res.headers.get("location")]).toEqual([302, "/"]);
  });
});

describe("cookies", () => {
  it("reads request cookies and sets cookies with secure defaults", async () => {
    const { fetch } = app({
      "src/routes/index.stsx": page(() => {
        const jar = cookies();
        jar.set("theme", "light mode", { httpOnly: false, maxAge: 3600 });
        jar.set("lang", "es");
        jar.delete("old");
        return `${jar.get("theme")}|${jar.get("session")}|${jar.get("old")}`;
      }),
    });
    const res = await fetch("/", { headers: { cookie: "session=abc; old=1" } });
    expect(await res.text()).toContain("<body>light mode|abc|undefined</body>");
    expect(res.headers.getSetCookie()).toEqual([
      "theme=light%20mode; Path=/; Max-Age=3600; Secure; SameSite=Lax",
      "lang=es; Path=/; HttpOnly; Secure; SameSite=Lax",
      "old=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Lax",
    ]);
  });

  it("omits Secure on http in dev", async () => {
    const handler = createRequestHandler({
      manifest: createRouteManifest([{ path: "index.stsx", source: "" }]),
      loadModule: async () => page(() => (cookies().set("a", "1"), "")),
      render: createStringRenderer(),
      dev: true,
    });
    const res = await handler.fetch(new Request("http://localhost:5173/"));
    expect(res.headers.get("set-cookie")).toBe("a=1; Path=/; HttpOnly; SameSite=Lax");
  });

  it("signs cookies with the env secret and rejects tampered values", async () => {
    const session = signedCookie("session");
    const { fetch } = app(
      {
        "src/routes/api/login.ts": {
          POST: async (ctx: RequestContext) => {
            await session.set(ctx.cookies, "user:42");
            return new Response("ok");
          },
        },
        "src/routes/api/me.ts": {
          GET: async (ctx: RequestContext) => new Response(String(await session.get(ctx.cookies))),
        },
      },
      { env: { LUMIOSE_SECRET: "s3cret" } },
    );
    const login = await fetch("/api/login", { method: "POST" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    expect(cookie).toMatch(/^session=user%3A42\.[\w-]{43}$/);
    expect(await (await fetch("/api/me", { headers: { cookie } })).text()).toBe("user:42");
    const forged = cookie.replace("42", "1");
    expect(await (await fetch("/api/me", { headers: { cookie: forged } })).text()).toBe(
      "undefined",
    );
  });
});
