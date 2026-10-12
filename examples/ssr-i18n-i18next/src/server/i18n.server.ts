// The server's i18next instance: created once with every locale's resources, and never switched to
// a language. Each request asks for a `t` fixed to its locale (getFixedT), so concurrent requests
// in different languages never share state. Server-only: the browser never downloads all locales.
import i18next, { type TFunction } from "i18next";
import { locale } from "lumiose";
import { options, type Namespaces } from "../lib/i18n.ts";
import enBasket from "../locales/en/basket.json" with { type: "json" };
import enSite from "../locales/en/site.json" with { type: "json" };
import esBasket from "../locales/es/basket.json" with { type: "json" };
import esSite from "../locales/es/site.json" with { type: "json" };
import frBasket from "../locales/fr/basket.json" with { type: "json" };
import frSite from "../locales/fr/site.json" with { type: "json" };

const i18n = i18next.createInstance({
  ...options,
  supportedLngs: ["en", "es", "fr"],
  ns: ["site", "basket"],
  defaultNS: "site",
  resources: {
    en: { site: enSite, basket: enBasket },
    es: { site: esSite, basket: esBasket },
    fr: { site: frSite, basket: frBasket },
  },
});
void i18n.init();

/** `t` in the request's locale. Call it in the component (or middleware, action, endpoint). */
export function getT(): TFunction<"site"> {
  return i18n.getFixedT(locale());
}

/** One namespace in the request's locale, for an island's props. */
export function messages<NS extends keyof Namespaces>(ns: NS): Namespaces[NS] {
  return i18n.getResourceBundle(locale(), ns) as Namespaces[NS];
}
