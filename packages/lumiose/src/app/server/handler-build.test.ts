// Handler options for built apps: `base`, `trailingSlash` and the prerendering guard (LUM5001).
import { describe, expect, it } from "vitest";
import type { Endpoint, Middleware } from "./context.ts";
import { cookies, env, locals, params, request, response, route, url } from "./scope.ts";
import { app, layout, page } from "./__fixtures__/app.ts";
import { testDefer } from "./__fixtures__/string-renderer.ts";

const body = async (res: Response) => {
  const html = await res.text();
  return html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
};

describe("base", () => {
  const modules = {
    "src/routes/index.stsx": page(() => `<h1>home ${url().pathname}</h1>`),
    "src/routes/about.stsx": page(() => "<h1>about</h1>"),
    "src/routes/_404.stsx": page((props) => `<p>404 ${props.status}</p>`),
    "src/routes/api/ping.ts": { GET: (() => new Response("pong")) as Endpoint },
  };

  it("matches routes below the base; ctx.url keeps the full path", async () => {
    const { fetch } = app(modules, { base: "/docs/" });
    expect(await body(await fetch("/docs/"))).toBe("<h1>home /docs/</h1>");
    expect(await body(await fetch("/docs"))).toBe("<h1>home /docs</h1>");
    expect(await body(await fetch("/docs/about"))).toBe("<h1>about</h1>");
    expect(await (await fetch("/docs/api/ping")).text()).toBe("pong");
  });

  it("renders the root _404 outside the base", async () => {
    const { fetch } = app(modules, { base: "/docs" });
    const res = await fetch("/about");
    expect(res.status).toBe(404);
    expect(await body(res)).toBe("<p>404 404</p>");
  });
});

describe("trailingSlash", () => {
  const modules = {
    "src/routes/index.stsx": page(() => "<h1>home</h1>"),
    "src/routes/about.stsx": page(() => "<h1>about</h1>"),
    "src/routes/sitemap.xml.ts": { GET: (() => new Response("<urlset/>")) as Endpoint },
  };

  it("ignore (default): both forms render", async () => {
    const { fetch } = app(modules);
    expect((await fetch("/about")).status).toBe(200);
    expect((await fetch("/about/")).status).toBe(200);
  });

  it("always: redirects page URLs without the slash (308, query kept); endpoints and / are left alone", async () => {
    const { fetch } = app(modules, { trailingSlash: "always", base: "/b/" });
    const res = await fetch("/b/about?x=1");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/b/about/?x=1");
    expect((await fetch("/b/about/")).status).toBe(200);
    expect((await fetch("/b/sitemap.xml")).status).toBe(200);
    expect((await fetch("/b/")).status).toBe(200);
  });

  it("never: redirects page URLs with the slash; POSTs are not redirected", async () => {
    const { fetch } = app(modules, { trailingSlash: "never" });
    const res = await fetch("/about/");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/about");
    expect((await fetch("/about")).status).toBe(200);
    expect((await fetch("/about/", { method: "POST" })).status).toBe(405);
  });
});

const lum5001 = (api: string) =>
  expect.objectContaining({
    code: "LUM5001",
    message: expect.stringContaining(`${api} reads the request`),
  });

/** Middleware may read the request while a route prerenders. */
const readingMiddleware: Middleware = (ctx, next) => {
  ctx.locals = {
    theme: ctx.cookies.get("theme") ?? "light",
    ua: ctx.request.headers.get("user-agent"),
  } as never;
  return next();
};

describe("prerendering (LUM5001)", () => {
  it.each([
    ["cookies()", () => cookies().get("theme")],
    ["locals()", () => locals()],
    ["request()", () => request().headers.get("accept")],
    ["response()", () => response().setStatus(201)],
    ["url().searchParams", () => url().searchParams.get("q")],
  ])("%s in a prerendered page", async (api, read) => {
    const { fetch, onError } = app(
      { "src/routes/index.stsx": page(() => `<p>${String(read())}</p>`) },
      { prerendering: true },
    );
    const res = await fetch("/");
    expect(res.status).toBe(500);
    expect(onError).toHaveBeenCalledWith(lum5001(api), expect.any(Request));
  });

  it("is reported even when an error boundary catches it, also inside Suspense", async () => {
    const { fetch, onError } = app(
      {
        "src/routes/index.stsx": page(() =>
          testDefer(async () => {
            try {
              cookies();
            } catch {
              // swallowed by the page, as an <ErrorBoundary> would
            }
            return "<p>ok</p>";
          }),
        ),
      },
      { prerendering: true },
    );
    expect((await fetch("/")).status).toBe(200);
    expect(onError).toHaveBeenCalledWith(lum5001("cookies()"), expect.any(Request));
  });

  it("allows url(), params(), env() and middleware reading the request", async () => {
    const { fetch, onError } = app(
      {
        "src/middleware.ts": { default: readingMiddleware },
        "src/routes/_layout.stsx": layout("main"),
        "src/routes/blog/[slug].stsx": page(
          () => `<h1>${url().pathname} ${params().slug} ${route()} ${env("SITE") ?? ""}</h1>`,
        ),
      },
      { prerendering: true, env: { SITE: "site" } },
    );
    const res = await fetch("/blog/hello");
    expect(onError).not.toHaveBeenCalled();
    expect(await body(res)).toBe("<main><h1>/blog/hello hello /blog/[slug] site</h1></main>");
  });

  it("guards ctx in endpoints and headers(ctx)", async () => {
    const { fetch, onError } = app(
      {
        "src/routes/feed.xml.ts": {
          GET: ((ctx) => new Response(`${ctx.url.pathname} ${ctx.cookies.get("a")}`)) as Endpoint,
        },
        "src/routes/index.stsx": {
          ...page(() => "<p>home</p>"),
          headers: (ctx: { request: Request }) => ({
            "x-ua": ctx.request.headers.get("user-agent") ?? "",
          }),
        },
      },
      { prerendering: true },
    );
    expect((await fetch("/feed.xml")).status).toBe(500);
    expect(onError).toHaveBeenCalledWith(lum5001("ctx.cookies"), expect.any(Request));
    onError.mockClear();
    expect((await fetch("/")).status).toBe(500);
    expect(onError).toHaveBeenCalledWith(lum5001("ctx.request"), expect.any(Request));
  });

  it("renders fully resolved, with no swap scripts", async () => {
    const { fetch } = app(
      { "src/routes/index.stsx": page(() => "<p>static</p>") },
      { prerendering: true },
    );
    expect(await body(await fetch("/"))).toBe("<p>static</p>");
  });

  it("leaves request APIs alone without prerendering", async () => {
    const { fetch, onError } = app({
      "src/routes/index.stsx": page(
        () => `<p>${cookies().get("a") ?? "none"} ${url().searchParams.get("q")}</p>`,
      ),
    });
    expect(await body(await fetch("/?q=1"))).toBe("<p>none 1</p>");
    expect(onError).not.toHaveBeenCalled();
  });
});
