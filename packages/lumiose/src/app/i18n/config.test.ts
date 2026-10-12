import { describe, expect, it } from "vitest";
import { routeHref } from "../routes/href.ts";
import { localizePath, negotiateLocale, resolveI18n, splitLocale } from "./config.ts";

const i18n = resolveI18n({ locales: ["en", "es", "pt-BR"], defaultLocale: "en" });

describe("splitLocale and localizePath", () => {
  it("reads the locale prefix; the default locale has none", () => {
    expect(splitLocale("/es/about", i18n)).toEqual({ locale: "es", path: "/about" });
    expect(splitLocale("/es", i18n)).toEqual({ locale: "es", path: "/" });
    expect(splitLocale("/es/", i18n)).toEqual({ locale: "es", path: "/" });
    expect(splitLocale("/pt-BR/blog/a", i18n)).toEqual({ locale: "pt-BR", path: "/blog/a" });
    expect(splitLocale("/about", i18n)).toEqual({ locale: "en", path: "/about" });
    expect(splitLocale("/en/about", i18n)).toEqual({ locale: "en", path: "/en/about" });
    expect(splitLocale("/esx/about", i18n)).toEqual({ locale: "en", path: "/esx/about" });
    expect(splitLocale("/", i18n)).toEqual({ locale: "en", path: "/" });
  });

  it("prefixes every locale but the default", () => {
    expect(localizePath("/about", "es", i18n)).toBe("/es/about");
    expect(localizePath("/", "es", i18n)).toBe("/es");
    expect(localizePath("/about", "en", i18n)).toBe("/about");
  });
});

describe("negotiateLocale", () => {
  it("picks by quality: an exact tag, then the same language", () => {
    expect(negotiateLocale("es-MX,es;q=0.9,en;q=0.5", i18n.locales)).toBe("es");
    expect(negotiateLocale("fr, pt-br;q=0.8", i18n.locales)).toBe("pt-BR");
    expect(negotiateLocale("pt", i18n.locales)).toBe("pt-BR");
    expect(negotiateLocale("de, en;q=0.1", i18n.locales)).toBe("en");
    expect(negotiateLocale("en;q=0.2, es;q=0.8", i18n.locales)).toBe("es");
    expect(negotiateLocale("es;q=0, *", i18n.locales)).toBeUndefined();
    expect(negotiateLocale(null, i18n.locales)).toBeUndefined();
  });
});

describe("routeHref", () => {
  it("builds a route's URL in a locale; params.locale switches it and is no param", () => {
    const options = { base: "/", i18n, locale: "es" };
    expect(routeHref("/about", {}, options)).toBe("/es/about");
    expect(routeHref("/about", { locale: "en" }, options)).toBe("/about");
    expect(routeHref("/", { locale: "pt-BR" }, options)).toBe("/pt-BR");
    expect(routeHref("/blog/[slug]", { slug: "a", locale: "en" }, options)).toBe("/blog/a");
    expect(routeHref("/about", {}, { base: "/docs/", i18n, trailingSlash: "always" })).toBe(
      "/docs/about/",
    );
    expect(() => routeHref("/about", { locale: "fr" }, options)).toThrow(
      'href("/about"): "fr" is not a locale of lumiose({ i18n }) (en, es, pt-BR).',
    );
    // Without i18n, `locale` is an ordinary param.
    expect(routeHref("/[locale]/x", { locale: "fr" }, { base: "/" })).toBe("/fr/x");
  });
});
