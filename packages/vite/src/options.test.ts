// `lumiose({ … })` project options (TASK-77, decision-21): validated and exposed as `api.options`.
import { describe, expect, it } from "vitest";
import lumiose, { type LumioseOptions } from "./index.ts";

const apiOf = (options?: LumioseOptions) => lumiose(options)[0]!.api!.options;
const create = (options: unknown) => () => lumiose(options as LumioseOptions);
/** What the plugin's config hook returns for `site` and a config `base`. */
const configOf = (site: string, base?: string) => {
  const plugin = lumiose({ site })[0]!;
  const hook = plugin.config as (config: object, env: object) => { base?: string };
  return hook(base === undefined ? {} : { base }, { command: "build", mode: "production" });
};

describe("lumiose() project options", () => {
  it("exposes mode, ssr, trailingSlash and csrf as api.options", () => {
    expect(apiOf()).toEqual({});
    expect(apiOf({ mode: "spa", ssr: false })).toEqual({ mode: "spa", ssr: false });
    expect(
      apiOf({
        mode: "server",
        trailingSlash: "never",
        csrf: { allowedOrigins: ["https://app.example.com", "http://localhost:5173"] },
        include: /\.stsx$/,
      }),
    ).toEqual({
      mode: "server",
      trailingSlash: "never",
      csrf: { allowedOrigins: ["https://app.example.com", "http://localhost:5173"] },
    });
    expect(apiOf({ csrf: false })).toEqual({ csrf: false });
    expect(Object.isFrozen(apiOf({ mode: "static" }))).toBe(true);
  });

  it("rejects invalid values with the option and the expected values", () => {
    expect(create({ mode: "ssg" })).toThrow(
      'lumiose({ mode }): expected one of "static", "server", "spa", got "ssg".',
    );
    expect(create({ ssr: "no" })).toThrow('lumiose({ ssr }): expected true or false, got "no".');
    expect(create({ trailingSlash: true })).toThrow(
      'lumiose({ trailingSlash }): expected one of "ignore", "always", "never", got true.',
    );
    expect(create({ csrf: true })).toThrow(
      "lumiose({ csrf }): expected false or { allowedOrigins }, got true.",
    );
    expect(create({ csrf: { allowedOrigins: "https://a.example" } })).toThrow(
      'lumiose({ csrf.allowedOrigins }): expected an array of origins, got "https://a.example".',
    );
    expect(create({ csrf: { allowedOrigins: ["https://a.example/"] } })).toThrow(
      /csrf\.allowedOrigins \}\): expected full origins .* got "https:\/\/a\.example\/"\./,
    );
    expect(create({ csrf: { allowed: [] } })).toThrow(
      "lumiose({ csrf.allowed }): unknown option. Known options: allowedOrigins.",
    );
    expect(create({ include: "*.stsx" })).toThrow(
      'lumiose({ include }): expected a RegExp, got "*.stsx".',
    );
    expect(create({ moed: "spa" })).toThrow(
      "lumiose({ moed }): unknown option. Known options: include, exclude, mode, ssr, prerender, trailingSlash, csrf, svg, md, html, viewTransitions, prefetch, csp, headers, limits, adapter, i18n, site.",
    );
    expect(create(null)).toThrow("lumiose(): expected an options object, got null.");
  });

  it("validates prerender (TASK-216)", () => {
    expect(apiOf({ mode: "spa", prerender: true })).toEqual({ mode: "spa", prerender: true });
    expect(create({ prerender: "yes" })).toThrow(
      'lumiose({ prerender }): expected true or false, got "yes".',
    );
    expect(create({ ssr: false, prerender: true })).toThrow(
      "lumiose({ prerender }): has no effect with ssr: false, which renders spa routes only in the browser. Remove one of them.",
    );
  });

  it("takes a deploy adapter (decision-45)", () => {
    const adapter = { name: "@lumiose/adapter-test", staticFiles: "platform" as const, adapt() {} };
    expect(apiOf({ adapter })).toEqual({ adapter });
    expect(create({ adapter: {} })).toThrow(
      "lumiose({ adapter }): expected an adapter such as cloudflare() from @lumiose/adapter-cloudflare, got an object.",
    );
    expect(create({ adapter: { ...adapter, staticFiles: "cdn" } })).toThrow(
      /lumiose\(\{ adapter \}\)/,
    );
  });

  it("validates i18n and fills in its defaults (decision-44)", () => {
    expect(apiOf({ i18n: { locales: ["en", "es"], defaultLocale: "en" } })).toEqual({
      i18n: { locales: ["en", "es"], defaultLocale: "en", missing: "404", detect: false },
    });
    expect(
      apiOf({
        i18n: {
          locales: ["en", "pt-BR"],
          defaultLocale: "pt-BR",
          missing: "redirect",
          detect: { cookie: "locale", acceptLanguage: true },
        },
      }).i18n,
    ).toEqual({
      locales: ["en", "pt-BR"],
      defaultLocale: "pt-BR",
      missing: "redirect",
      detect: { cookie: "locale", acceptLanguage: true },
    });
    expect(create({ i18n: { locales: [], defaultLocale: "en" } })).toThrow(
      'lumiose({ i18n.locales }): expected a non-empty array of locales such as ["en", "es"].',
    );
    expect(create({ i18n: { locales: ["en", "es/mx"], defaultLocale: "en" } })).toThrow(
      'lumiose({ i18n.locales }): "es/mx" is not a locale: use a URL path segment such as "en" or "pt-BR".',
    );
    expect(create({ i18n: { locales: ["en", "en"], defaultLocale: "en" } })).toThrow(
      "lumiose({ i18n.locales }): each locale may appear once.",
    );
    expect(create({ i18n: { locales: ["en"], defaultLocale: "es" } })).toThrow(
      'lumiose({ i18n.defaultLocale }): expected one of the locales (en), got "es".',
    );
    expect(create({ i18n: { locales: ["en"], defaultLocale: "en", missing: 404 } })).toThrow(
      'lumiose({ i18n.missing }): expected "404" or "redirect", got 404.',
    );
    expect(create({ i18n: { locales: ["en"], defaultLocale: "en", detect: {} } })).toThrow(
      "lumiose({ i18n.detect }): detects nothing: set cookie, acceptLanguage: true, or both.",
    );
    expect(
      create({ i18n: { locales: ["en"], defaultLocale: "en", detect: { header: true } } }),
    ).toThrow(
      "lumiose({ i18n.detect.header }): unknown option. Known options: cookie, acceptLanguage.",
    );
    expect(create({ i18n: ["en"] })).toThrow(
      "lumiose({ i18n }): expected { locales, defaultLocale }.",
    );
  });

  it("normalizes site, with or without a path", () => {
    expect(apiOf({ site: "https://example.com" })).toEqual({ site: "https://example.com/" });
    expect(apiOf({ site: "https://example.com/docs" })).toEqual({
      site: "https://example.com/docs/",
    });
    expect(apiOf({ site: "https://example.com/docs/" })).toEqual({
      site: "https://example.com/docs/",
    });
    for (const site of ["example.com", "https://example.com/?x=1", "https://example.com/#top", 7]) {
      expect(create({ site })).toThrow(
        /^lumiose\(\{ site \}\): expected the site's URL such as "https:\/\/example.com" or "https:\/\/example.com\/docs", got /,
      );
    }
  });

  it("makes the site's path Vite's base, and refuses another base", () => {
    expect(configOf("https://example.com/docs").base).toBe("/docs/");
    expect(configOf("https://example.com").base).toBeUndefined();
    expect(configOf("https://example.com/docs", "/docs").base).toBeUndefined();
    expect(configOf("https://example.com/docs/", "/docs/").base).toBeUndefined();
    expect(() => configOf("https://example.com/docs", "/app/")).toThrow(
      'lumiose({ site }): the site\'s path "/docs/" differs from Vite\'s base "/app/". Remove one of them, or make them match.',
    );
    // A site without a path is an origin: any base goes with it.
    expect(configOf("https://example.com", "/app/").base).toBeUndefined();
  });

  it("validates csp (TASK-138)", () => {
    expect(apiOf({ csp: "strict" })).toEqual({ csp: "strict" });
    expect(create({ csp: true })).toThrow('lumiose({ csp }): expected one of "strict", got true.');
  });

  it("validates the MPA navigation options viewTransitions and prefetch (TASK-93)", () => {
    expect(apiOf({ viewTransitions: true, prefetch: "viewport" })).toEqual({
      viewTransitions: true,
      prefetch: "viewport",
    });
    expect(apiOf({ prefetch: "none" })).toEqual({ prefetch: "none" });
    expect(create({ viewTransitions: "auto" })).toThrow(
      'lumiose({ viewTransitions }): expected true or false, got "auto".',
    );
    expect(create({ prefetch: "eager" })).toThrow(
      'lumiose({ prefetch }): expected one of "hover", "viewport", "none", got "eager".',
    );
    expect(create({ prefetch: false })).toThrow(
      'lumiose({ prefetch }): expected one of "hover", "viewport", "none", got false.',
    );
  });

  it("validates headers: a record, or { path, headers } rules (TASK-125)", () => {
    const coop = { "cross-origin-opener-policy": "same-origin" };
    expect(apiOf({ headers: coop })).toEqual({ headers: coop });
    const rules = [{ path: "/assets/**", headers: { "cache-control": "no-cache" } }];
    expect(apiOf({ headers: rules })).toEqual({ headers: rules });
    expect(create({ headers: "x" })).toThrow(
      'lumiose({ headers }): expected a record of header names to values, got "x".',
    );
    expect(create({ headers: { "x-a": 1 } })).toThrow(
      "lumiose({ headers.x-a }): expected a string, got 1.",
    );
    expect(create({ headers: [{ path: "assets", headers: {} }] })).toThrow(
      'lumiose({ headers[0].path }): expected a path pattern such as "/assets/**", got "assets".',
    );
    expect(create({ headers: [{ path: "/", headers: {}, when: 1 }] })).toThrow(
      "lumiose({ headers[0].when }): unknown option. Known options: path, headers.",
    );
  });
});
