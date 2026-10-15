// Folder middleware and `ctx.route` (decision-48, TASK-294): a `middleware.ts` in a route folder
// runs for the pages, form actions and endpoints below it, after `src/middleware.ts` and the
// route's locale checks, outermost folder first.
import { describe, expect, it, vi } from "vitest";
import { resolveI18n } from "../i18n/config.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { app, page, type Modules } from "./__fixtures__/app.ts";
import { createStringRenderer } from "./__fixtures__/string-renderer.ts";
import type { Middleware } from "./context.ts";
import { error, redirect } from "./control.ts";
import { createRequestHandler, type ModuleExports } from "./handler.ts";
import { locals } from "./scope.ts";

const SERVER = { defaultMode: "server" } as const;

/** Middleware that logs `name:route` before and `name:after` after the rest of the chain. */
const tracer =
  (log: string[], name: string): Middleware =>
  async (ctx, next) => {
    log.push(`${name}:${ctx.route ?? "-"}`);
    const response = await next();
    log.push(`${name}:after`);
    return response;
  };

const logged = (log: string[], name: string): ModuleExports => ({ default: tracer(log, name) });

/** Lets requests with an admin `authorization` header through. */
const deny: Middleware<"/admin"> = (ctx, next) =>
  ctx.request.headers.get("authorization") === "admin"
    ? next()
    : Promise.resolve(new Response("denied", { status: 401 }));

describe("folder middleware", () => {
  it("runs after src/middleware.ts, outermost folder first, and unwinds in reverse", async () => {
    const log: string[] = [];
    const { fetch } = app(
      {
        "src/middleware.ts": logged(log, "root"),
        "src/routes/admin/middleware.ts": logged(log, "admin"),
        "src/routes/admin/users/[id]/middleware.ts": {
          default: [tracer(log, "user1"), tracer(log, "user2")],
        },
        "src/routes/admin/users/[id]/page.stsx": page(({ params }) => {
          log.push("page");
          return `<h1>${params.id}</h1>`;
        }),
      },
      {},
      SERVER,
    );
    expect(await (await fetch("/admin/users/7")).text()).toContain("<h1>7</h1>");
    expect(log).toEqual([
      "root:/admin/users/[id]",
      "admin:/admin/users/[id]",
      "user1:/admin/users/[id]",
      "user2:/admin/users/[id]",
      "page",
      "user2:after",
      "user1:after",
      "admin:after",
      "root:after",
    ]);
  });

  it("runs for nothing outside its folder, and only src/middleware.ts runs for unmatched URLs", async () => {
    const log: string[] = [];
    const { fetch } = app(
      {
        "src/middleware.ts": logged(log, "root"),
        "src/routes/admin/middleware.ts": logged(log, "admin"),
        "src/routes/admin/page.stsx": page(() => "<h1>admin</h1>"),
        "src/routes/administrators/page.stsx": page(() => "<h1>others</h1>"),
        "src/routes/page.stsx": page(() => "<h1>home</h1>"),
      },
      {},
      SERVER,
    );
    for (const path of ["/", "/administrators", "/admin/missing", "/nowhere"]) await fetch(path);
    expect(log).toEqual([
      "root:/",
      "root:after",
      "root:/administrators",
      "root:after",
      "root:-",
      "root:after",
      "root:-",
      "root:after",
    ]);
  });

  it("guards form actions and endpoints below its folder", async () => {
    const action = vi.fn(() => ({ ok: true }));
    const endpoint = vi.fn(() => new Response("data"));
    const { fetch } = app(
      {
        "src/routes/admin/middleware.ts": { default: deny },
        "src/routes/admin/page.stsx": {
          default: () => "<h1>admin</h1>",
          actions: { save: action },
        },
        "src/routes/admin/api/route.ts": { GET: endpoint, POST: endpoint },
      },
      {},
      SERVER,
    );
    const post = (path: string, headers: HeadersInit = {}) =>
      fetch(path, {
        method: "POST",
        headers: { origin: "https://lumiose.test", ...headers },
        body: new URLSearchParams({ a: "1" }),
      });
    expect((await post("/admin?/save")).status).toBe(401);
    expect((await fetch("/admin/api")).status).toBe(401);
    expect((await post("/admin/api")).status).toBe(401);
    expect(action).not.toHaveBeenCalled();
    expect(endpoint).not.toHaveBeenCalled();

    const authorized = { authorization: "admin" };
    expect((await post("/admin?/save", authorized)).status).toBe(200);
    expect(await (await fetch("/admin/api", { headers: authorized })).text()).toBe("data");
    expect(action).toHaveBeenCalledOnce();
    expect(endpoint).toHaveBeenCalledOnce();
  });

  it("covers the routes of a group folder without a URL segment", async () => {
    const log: string[] = [];
    const { fetch } = app(
      {
        "src/routes/(account)/middleware.ts": logged(log, "account"),
        "src/routes/(account)/settings/page.stsx": page(() => "<h1>settings</h1>"),
        "src/routes/(marketing)/pricing/page.stsx": page(() => "<h1>pricing</h1>"),
      },
      {},
      SERVER,
    );
    await fetch("/pricing");
    await fetch("/settings");
    expect(log).toEqual(["account:/settings", "account:after"]);
  });

  it("covers both URLs of an optional segment and types params by its folder", async () => {
    const seen: unknown[] = [];
    const docs: Middleware<"/[[lang]]/docs"> = (ctx, next) => {
      seen.push([ctx.route, { ...ctx.params }]);
      return next();
    };
    const { fetch } = app(
      {
        "src/routes/[[lang]]/docs/middleware.ts": { default: docs },
        "src/routes/[[lang]]/docs/[...path]/page.stsx": page(() => "<h1>doc</h1>"),
      },
      {},
      SERVER,
    );
    await fetch("/docs/intro");
    await fetch("/de/docs/a/b");
    expect(seen).toEqual([
      ["/[[lang]]/docs/[...path]", { path: "intro" }],
      ["/[[lang]]/docs/[...path]", { lang: "de", path: "a/b" }],
    ]);
  });

  it("shares locals with the page and can set headers on its response", async () => {
    const { fetch } = app(
      {
        "src/middleware.ts": {
          default: ((ctx, next) => {
            (ctx.locals as { trail?: string[] }).trail = ["root"];
            return next();
          }) satisfies Middleware,
        },
        "src/routes/shop/middleware.ts": {
          default: (async (ctx, next) => {
            (ctx.locals as { trail: string[] }).trail.push("shop");
            const response = await next();
            response.headers.set("x-shop", "1");
            return response;
          }) satisfies Middleware<"/shop">,
        },
        "src/routes/shop/page.stsx": page(
          () => `<h1>${(locals() as { trail: string[] }).trail.join(",")}</h1>`,
        ),
      },
      {},
      SERVER,
    );
    const response = await fetch("/shop");
    expect(await response.text()).toContain("<h1>root,shop</h1>");
    expect(response.headers.get("x-shop")).toBe("1");
  });

  it("renders the route's error page outside the chain for what it throws", async () => {
    const { fetch } = app(
      {
        "src/routes/admin/middleware.ts": {
          default: ((ctx, next) => {
            if (ctx.url.searchParams.has("old")) redirect("/admin/new");
            if (ctx.url.searchParams.has("deny")) error(403, "Admins only");
            if (ctx.url.searchParams.has("crash")) throw new Error("boom");
            return next();
          }) satisfies Middleware,
        },
        "src/routes/admin/error.stsx": page(
          (props) => `<p>admin error ${props.status} ${props.error.message}</p>`,
        ),
        "src/routes/admin/page.stsx": page(() => "<h1>admin</h1>"),
        "src/routes/admin/api/route.ts": { GET: () => new Response("data") },
      },
      {},
      SERVER,
    );
    const moved = await fetch("/admin?old");
    expect(moved.status).toBe(302);
    expect(moved.headers.get("location")).toBe("/admin/new");
    const denied = await fetch("/admin?deny");
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain("<p>admin error 403 Admins only</p>");
    const crashed = await fetch("/admin?crash");
    expect(crashed.status).toBe(500);
    expect(await crashed.text()).toContain("<p>admin error 500 Internal Server Error</p>");
    const api = await fetch("/admin/api?deny");
    expect(api.status).toBe(403);
    expect(await api.text()).toBe("Admins only");
  });

  it("reports a middleware that returns no Response, naming its file", async () => {
    const { fetch, onError } = app(
      {
        "src/routes/admin/middleware.ts": { default: () => undefined },
        "src/routes/admin/page.stsx": page(() => "<h1>admin</h1>"),
      },
      {},
      SERVER,
    );
    expect((await fetch("/admin")).status).toBe(500);
    expect(onError).toHaveBeenCalledWith(
      new TypeError(
        "Middleware #1 in src/routes/admin/middleware.ts must return a Response (usually `return next()`).",
      ),
      expect.any(Request),
    );
  });

  it("runs after the locale checks, for the route in every locale", async () => {
    const log: string[] = [];
    const modules: Modules = {
      "src/routes/admin/middleware.ts": {
        default: ((ctx, next) => {
          log.push(`${ctx.locale} ${ctx.route}`);
          return next();
        }) satisfies Middleware,
      },
      "src/routes/admin/page.stsx": page(() => "<h1>admin</h1>"),
    };
    const manifest = createRouteManifest(
      [
        { path: "admin/middleware.ts", source: "" },
        { path: "admin/page.stsx", source: 'export const locales = ["en", "es"];' },
      ],
      {
        defaultMode: "server",
        i18n: resolveI18n({ locales: ["en", "es", "fr"], defaultLocale: "en" }),
      },
    );
    const { fetch } = createRequestHandler({
      manifest,
      loadModule: async (file) => modules[file]!,
      render: createStringRenderer(),
      onError: vi.fn(),
    });
    const get = (path: string) => fetch(new Request(new URL(path, "https://lumiose.test")));
    expect((await get("/es/admin")).status).toBe(200);
    expect((await get("/admin")).status).toBe(200);
    // A locale the route does not declare is a 404 before the folder middleware runs.
    expect((await get("/fr/admin")).status).toBe(404);
    expect(log).toEqual(["es /admin", "en /admin"]);
  });

  it("runs unguarded while prerendering, like src/middleware.ts", async () => {
    const { fetch, onError } = app(
      {
        "src/routes/blog/middleware.ts": {
          default: (async (ctx, next) => {
            (ctx.locals as { theme?: string }).theme = ctx.cookies.get("theme") ?? "light";
            const response = await next();
            response.headers.set("x-route", ctx.route ?? "");
            return response;
          }) satisfies Middleware<"/blog">,
        },
        "src/routes/blog/[slug]/page.stsx": page(({ params }) => `<h1>${params.slug}</h1>`),
      },
      { prerendering: true },
      // A static manifest would warn (LUM5008, tested with the manifest).
      SERVER,
    );
    const response = await fetch("/blog/hello");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-route")).toBe("/blog/[slug]");
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("ctx.route", () => {
  it("is the matched pattern in src/middleware.ts, endpoints and actions, else undefined", async () => {
    const seen: unknown[] = [];
    const { fetch } = app({
      "src/middleware.ts": {
        default: ((ctx, next) => {
          seen.push(ctx.route);
          return next();
        }) satisfies Middleware,
      },
      "src/routes/books/[isbn]/page.stsx": {
        default: () => "<h1>book</h1>",
        action: (ctx: { route: string }) => {
          seen.push(`action ${ctx.route}`);
          return null;
        },
      },
      "src/routes/api/books/route.ts": {
        GET: (ctx: { route: string }) => new Response(ctx.route),
      },
    });
    await fetch("/books/1");
    await fetch("/missing");
    expect(await (await fetch("/api/books")).text()).toBe("/api/books");
    await fetch("/books/2", {
      method: "POST",
      headers: { origin: "https://lumiose.test" },
      body: new URLSearchParams(),
    });
    expect(seen).toEqual([
      "/books/[isbn]",
      undefined,
      "/api/books",
      "/books/[isbn]",
      "action /books/[isbn]",
    ]);
  });
});
