// Locale routing in the request handler (decision-44, TASK-254): prefixes, declared locales,
// missing translations, detection, `<html lang>`, hreflang and canonical links, `alternates()`
// and the request-aware `href()`.
import { describe, expect, it, vi } from "vitest";
import { alternates, href, locale } from "../i18n/server.ts";
import { resolveI18n, type I18nOptions } from "../i18n/config.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { locale as routerLocale } from "../router/index.server.ts";
import {
  createStringRenderer,
  resolve as resolveFixture,
  testHead,
} from "./__fixtures__/string-renderer.ts";
import type { RequestContext } from "./context.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import { navigationHead } from "./navigation.ts";

type Props = any;

const ROUTES = "src/routes/";
const I18N: I18nOptions = { locales: ["en", "es", "fr"], defaultLocale: "en" };

/** Route files as `[source, module]` (the source declares `locales`), served by a handler. */
function i18nApp(
  files: Record<string, [source: string, module: ModuleExports]>,
  i18n: I18nOptions = I18N,
  options: Partial<RequestHandlerOptions> = {},
) {
  const manifest = createRouteManifest(
    Object.entries(files)
      .filter(([file]) => file.startsWith(ROUTES))
      .map(([file, [source]]) => ({ path: file.slice(ROUTES.length), source })),
    { i18n: resolveI18n(i18n) },
  );
  expect(manifest.diagnostics).toEqual([]);
  const onError = vi.fn();
  const { fetch: handle } = createRequestHandler({
    manifest,
    loadModule: async (file) => {
      const entry = files[file];
      if (entry === undefined) throw new Error(`no module ${file}`);
      return entry[1];
    },
    render: createStringRenderer(),
    onError,
    ...("src/document.tsx" in files ? { document: "src/document.tsx" } : {}),
    ...options,
  });
  const fetch = (path: string, init?: RequestInit) =>
    handle(new Request(new URL(path, "https://lumiose.test"), init));
  return { fetch, onError };
}

/** A page that prints the request's locale and its alternates. */
const localePage = (name: string): ModuleExports => ({
  default: () => {
    const links = alternates()
      .map((each) => `${each.locale}=${each.href}`)
      .join(",");
    return `<h1>${name} ${locale()}</h1><p>${links}</p>`;
  },
});

const notFound: [string, ModuleExports] = [
  "",
  { default: (props: Props) => `<h1>${props.status} ${locale()}</h1>` },
];

const text = async (response: Response) => response.text();
const hreflang = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g)].map((m) => m[0]);
const canonical = (html: string) =>
  [...html.matchAll(/<link rel="canonical"[^>]*>/g)].map((m) => m[0]);

describe("locale prefixes", () => {
  const { fetch } = i18nApp({
    "src/routes/page.stsx": ['export const locales = "all";', localePage("home")],
    "src/routes/about/page.stsx": ['export const locales = ["en", "es"];', localePage("about")],
    "src/routes/contact/page.stsx": ["", localePage("contact")],
    "src/routes/only-es/page.stsx": ['export const locales = ["es"];', localePage("only-es")],
    "src/routes/not-found.stsx": notFound,
  });

  it("serves the default locale unprefixed and the others under their prefix", async () => {
    expect(await text(await fetch("/about"))).toContain("<h1>about en</h1>");
    expect(await text(await fetch("/es/about"))).toContain("<h1>about es</h1>");
    expect(await text(await fetch("/"))).toContain("<h1>home en</h1>");
    expect(await text(await fetch("/fr"))).toContain("<h1>home fr</h1>");
    expect(await text(await fetch("/fr/"))).toContain("<h1>home fr</h1>");
  });

  it("serves a page only in the locales it declares; without a declaration, the default one", async () => {
    const fr = await fetch("/fr/about");
    expect(fr.status).toBe(404);
    expect(await text(fr)).toContain("<h1>404 fr</h1>");
    expect((await fetch("/es/contact")).status).toBe(404);
    expect((await fetch("/contact")).status).toBe(200);
    expect((await fetch("/only-es")).status).toBe(404);
    expect((await fetch("/es/only-es")).status).toBe(200);
  });

  it("never serves the default locale under a prefix", async () => {
    expect((await fetch("/en/about")).status).toBe(404);
    expect((await fetch("/en")).status).toBe(404);
  });

  it("sets <html lang> to the request's locale", async () => {
    expect(await text(await fetch("/es/about"))).toMatch(/^<!doctype html><html lang="es">/);
    expect(await text(await fetch("/about"))).toMatch(/^<!doctype html><html lang="en">/);
    // Error pages too.
    expect(await text(await fetch("/fr/about"))).toMatch(/^<!doctype html><html lang="fr">/);
  });
});

describe("custom documents", () => {
  it("get the request's locale as the lang of <html>, set or added", async () => {
    for (const [tag, expected] of [
      ['<html lang="en" data-x="1">', '<html lang="es" data-x="1">'],
      ["<html class='app'>", "<html lang=\"es\" class='app'>"],
    ]) {
      const { fetch } = i18nApp({
        "src/document.tsx": [
          "",
          {
            default: async ({ head, body }: Props) => ({
              t: `${tag}<head>${head.t}</head><body>${await resolveFixture(body)}</body></html>`,
            }),
          },
        ],
        "src/routes/page.stsx": ['export const locales = ["es"];', { default: () => "<h1>x</h1>" }],
      });
      expect(await text(await fetch("/es"))).toBe(
        `<!doctype html>${expected}<head></head><body><h1>x</h1></body></html>`,
      );
    }
  });
});

describe("declared locales", () => {
  it("inherits a layout's locales; the page's own export wins", async () => {
    const { fetch } = i18nApp({
      "src/routes/docs/layout.stsx": [
        'export const locales = ["en", "fr"];',
        { default: async (props: Props) => `<main>${await props.children}</main>` },
      ],
      "src/routes/docs/page.stsx": ["", localePage("docs")],
      "src/routes/docs/intro/page.stsx": ['export const locales = ["en"];', localePage("intro")],
    });
    expect((await fetch("/fr/docs")).status).toBe(200);
    expect((await fetch("/es/docs")).status).toBe(404);
    expect((await fetch("/fr/docs/intro")).status).toBe(404);
    expect((await fetch("/docs/intro")).status).toBe(200);
  });

  it("asks a locales({ params }) function for content-driven pages", async () => {
    const translations: Record<string, string[]> = { hello: ["en", "es"], hola: ["es"] };
    const locales = vi.fn(
      async ({ params }: { params: Record<string, string> }) => translations[params.slug!] ?? [],
    );
    const { fetch } = i18nApp({
      "src/routes/blog/[slug]/page.stsx": [
        "export async function locales({ params }) { return []; }",
        { ...localePage("post"), locales },
      ],
    });
    expect(await text(await fetch("/es/blog/hello"))).toContain("en=/blog/hello,es=/es/blog/hello");
    expect((await fetch("/blog/hello")).status).toBe(200);
    expect((await fetch("/fr/blog/hello")).status).toBe(404);
    expect((await fetch("/blog/hola")).status).toBe(404);
    expect((await fetch("/es/blog/hola")).status).toBe(200);
    expect(locales).toHaveBeenCalledWith({ params: { slug: "hola" } });
  });

  it("gives endpoints locales like pages, and ctx.locale to middleware and endpoints", async () => {
    const seen: string[] = [];
    const { fetch } = i18nApp(
      {
        "src/middleware.ts": [
          "",
          {
            default: (ctx: RequestContext, next: () => Promise<Response>) => {
              seen.push(ctx.locale);
              return next();
            },
          },
        ],
        "src/routes/api/hello/route.ts": [
          'export const locales = ["en", "es"];',
          { GET: (ctx: RequestContext) => new Response(`hello ${ctx.locale}`) },
        ],
        "src/routes/api/plain/route.ts": ["", { GET: () => new Response("plain") }],
      },
      I18N,
      { middleware: "src/middleware.ts" },
    );
    expect(await text(await fetch("/es/api/hello"))).toBe("hello es");
    expect((await fetch("/fr/api/hello")).status).toBe(404);
    expect((await fetch("/es/api/plain")).status).toBe(404);
    expect(await text(await fetch("/api/plain"))).toBe("plain");
    expect(seen).toEqual(["es", "fr", "es", "en"]);
  });
});

describe("missing translations", () => {
  const files = {
    "src/routes/about/page.stsx": ["", localePage("about")] as [string, ModuleExports],
    "src/routes/only-es/page.stsx": ['export const locales = ["es"];', localePage("es")] as [
      string,
      ModuleExports,
    ],
  };

  it('redirects to the default locale\'s page with missing: "redirect"', async () => {
    const { fetch } = i18nApp(files, { ...I18N, missing: "redirect" });
    const get = await fetch("/es/about?x=1", { redirect: "manual" });
    expect(get.status).toBe(302);
    expect(get.headers.get("location")).toBe("/about?x=1");
    const post = await fetch("/es/about", { method: "POST", redirect: "manual" });
    expect(post.status).toBe(307);
    // No page in the default locale to redirect to.
    expect((await fetch("/fr/only-es")).status).toBe(404);
  });

  it('is a 404 with missing: "404" (the default)', async () => {
    const { fetch } = i18nApp(files);
    expect((await fetch("/es/about")).status).toBe(404);
  });
});

describe("hreflang, canonical and alternates()", () => {
  const { fetch } = i18nApp({
    "src/routes/about/page.stsx": ['export const locales = ["en", "es"];', localePage("about")],
    "src/routes/contact/page.stsx": ["", localePage("contact")],
    "src/routes/own/page.stsx": [
      'export const locales = "all";',
      {
        default: () =>
          `${testHead('<link rel="canonical" href="https://example.com/own">')}<h1>own</h1>`,
      },
    ],
  });

  it("links the declared locales only, with absolute URLs, and a canonical to the page itself", async () => {
    const html = await text(await fetch("/es/about"));
    expect(hreflang(html)).toEqual([
      '<link rel="alternate" hreflang="en" href="https://lumiose.test/about">',
      '<link rel="alternate" hreflang="es" href="https://lumiose.test/es/about">',
    ]);
    expect(html).not.toContain('hreflang="fr"');
    expect(html).not.toContain("x-default");
    expect(canonical(html)).toEqual([
      '<link rel="canonical" href="https://lumiose.test/es/about">',
    ]);
    expect(html).toContain("<p>en=/about,es=/es/about</p>");
  });

  it("writes no alternates, hreflang or canonical for a page in one locale", async () => {
    const html = await text(await fetch("/contact"));
    expect(hreflang(html)).toEqual([]);
    expect(canonical(html)).toEqual([]);
    expect(html).toContain("<p>en=/contact</p>");
  });

  it("keeps the page's own canonical instead of Lumiose's", async () => {
    const html = await text(await fetch("/fr/own"));
    expect(canonical(html)).toEqual(['<link rel="canonical" href="https://example.com/own">']);
    expect(hreflang(html)).toHaveLength(3);
  });

  it("uses lumiose({ site }) while prerendering, else root-relative URLs", async () => {
    const files: Record<string, [string, ModuleExports]> = {
      "src/routes/about/page.stsx": ['export const locales = ["en", "es"];', localePage("about")],
    };
    const withSite = i18nApp(files, I18N, { prerendering: true, site: "https://example.com" });
    const html = await text(await withSite.fetch("/es/about"));
    expect(canonical(html)).toEqual(['<link rel="canonical" href="https://example.com/es/about">']);
    expect(hreflang(html)[0]).toBe(
      '<link rel="alternate" hreflang="en" href="https://example.com/about">',
    );
    const without = i18nApp(files, I18N, { prerendering: true });
    expect(canonical(await text(await without.fetch("/es/about")))).toEqual([
      '<link rel="canonical" href="/es/about">',
    ]);
  });

  it("adds the origin to the href() path, which has the base: per request and prerendered", async () => {
    const files: Record<string, [string, ModuleExports]> = {
      "src/routes/about/page.stsx": ['export const locales = ["en", "es"];', localePage("about")],
    };
    const perRequest = i18nApp(files, I18N, { base: "/docs/", trailingSlash: "always" });
    const html = await text(await perRequest.fetch("/docs/es/about/"));
    expect(canonical(html)).toEqual([
      '<link rel="canonical" href="https://lumiose.test/docs/es/about/">',
    ]);
    expect(hreflang(html)[0]).toBe(
      '<link rel="alternate" hreflang="en" href="https://lumiose.test/docs/about/">',
    );
    const prerendered = i18nApp(files, I18N, {
      base: "/docs/",
      prerendering: true,
      site: "https://example.com",
    });
    expect(canonical(await text(await prerendered.fetch("/docs/es/about")))).toEqual([
      '<link rel="canonical" href="https://example.com/docs/es/about">',
    ]);
  });

  it("builds alternates below base and with the trailing-slash policy", async () => {
    const below = i18nApp(
      { "src/routes/about/page.stsx": ['export const locales = "all";', localePage("about")] },
      I18N,
      { base: "/docs/", trailingSlash: "always" },
    );
    expect(await text(await below.fetch("/docs/fr/about/"))).toContain(
      "<p>en=/docs/about/,es=/docs/es/about/,fr=/docs/fr/about/</p>",
    );
  });
});

describe("href() and locale() in a request", () => {
  it("builds URLs in the request's locale unless { locale } names another", async () => {
    const { fetch } = i18nApp({
      "src/routes/about/page.stsx": [
        'export const locales = "all";',
        {
          default: () =>
            [
              href("/about"),
              href("/about", { locale: "en" } as never),
              href("/blog/[slug]", { slug: "a", locale: "fr" } as never),
              routerLocale(),
            ].join(" "),
        },
      ],
      "src/routes/blog/[slug]/page.stsx": ["", localePage("post")],
    });
    expect(await text(await fetch("/es/about"))).toContain("/es/about /about /fr/blog/a es");
  });

  it("throws on a locale lumiose({ i18n }) does not configure", async () => {
    const { fetch, onError } = i18nApp({
      "src/routes/page.stsx": ["", { default: () => href("/", { locale: "de" } as never) }],
    });
    expect((await fetch("/")).status).toBe(500);
    expect(String(onError.mock.calls[0]![0])).toContain(
      'href("/"): "de" is not a locale of lumiose({ i18n }) (en, es, fr).',
    );
  });

  it("leaves locale() undefined and URLs unprefixed without lumiose({ i18n })", async () => {
    const manifest = createRouteManifest([{ path: "page.stsx", source: "" }]);
    const { fetch } = createRequestHandler({
      manifest,
      loadModule: async () => ({ default: () => `[${String(locale())}] ${href("/")}` }),
      render: createStringRenderer(),
    });
    const html = await text(await fetch(new Request("https://lumiose.test/")));
    expect(html).toContain("[undefined] /");
    expect(html).toMatch(/^<!doctype html><html lang="en">/);
  });
});

describe("detection", () => {
  const files: Record<string, [string, ModuleExports]> = {
    "src/routes/page.stsx": ['export const locales = "all";', localePage("home")],
    "src/routes/about/page.stsx": ['export const locales = ["en", "es"];', localePage("about")],
    "src/routes/contact/page.stsx": ["", localePage("contact")],
  };
  const detecting = i18nApp(files, {
    ...I18N,
    detect: { cookie: "locale", acceptLanguage: true },
  });
  const get = (path: string, headers: Record<string, string> = {}) =>
    detecting.fetch(path, { headers, redirect: "manual" });

  it("redirects a first visit to the Accept-Language locale and records it in the cookie", async () => {
    const response = await get("/about", { "accept-language": "es-MX,es;q=0.9,en;q=0.5" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/es/about");
    expect(response.headers.get("set-cookie")).toMatch(/^locale=es; Path=\/; Max-Age=31536000;/);
    expect(response.headers.get("set-cookie")).not.toContain("HttpOnly");
    expect(response.headers.get("vary")).toBe("Cookie, Accept-Language");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("stays when the page does not declare the visitor's locale, and still records it", async () => {
    const response = await get("/contact", { "accept-language": "es" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/^locale=es;/);
  });

  it("never redirects a deep link when the cookie exists", async () => {
    const response = await get("/about", { cookie: "locale=es", "accept-language": "es" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
  });

  it("redirects / to the cookie's locale", async () => {
    const es = await get("/", { cookie: "locale=es", "accept-language": "fr" });
    expect(es.status).toBe(302);
    expect(es.headers.get("location")).toBe("/es");
    expect(es.headers.get("vary")).toBe("Cookie, Accept-Language");
    const en = await get("/", { cookie: "locale=en", "accept-language": "fr" });
    expect(en.status).toBe(200);
    expect(en.headers.get("cache-control")).toBe("private, no-store");
  });

  it("never redirects a prefixed URL", async () => {
    const response = await get("/es/about", { "accept-language": "en" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("detects only on / without a cookie to tell first visits apart", async () => {
    const { fetch } = i18nApp(files, { ...I18N, detect: { acceptLanguage: true } });
    const deep = await fetch("/about", {
      headers: { "accept-language": "es" },
      redirect: "manual",
    });
    expect(deep.status).toBe(200);
    expect(deep.headers.get("vary")).toBeNull();
    const root = await fetch("/", { headers: { "accept-language": "fr" }, redirect: "manual" });
    expect(root.headers.get("location")).toBe("/fr");
  });

  it("is off by default and while prerendering", async () => {
    const off = i18nApp(files);
    expect((await off.fetch("/about", { headers: { "accept-language": "es" } })).status).toBe(200);
    const prerendering = i18nApp(
      files,
      { ...I18N, detect: { cookie: "locale", acceptLanguage: true } },
      { prerendering: true },
    );
    const response = await prerendering.fetch("/about", { headers: { "accept-language": "es" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("speculation rules", () => {
  it("leave out endpoints under every locale prefix", () => {
    const manifest = createRouteManifest([{ path: "api/[id]/route.ts", source: "" }]);
    const head = navigationHead({ prefetch: "hover" }, manifest.routes, "/", resolveI18n(I18N));
    const pattern = "{/(es|fr)}?/api/:p1{/}?";
    expect(head.mpa.plain).toContain(JSON.stringify(pattern).slice(1, -1));
    const matches = (pathname: string) => new URLPattern({ pathname: pattern }).test({ pathname });
    expect(["/api/1", "/es/api/1", "/fr/api/1/", "/en/api/1"].map(matches)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});
