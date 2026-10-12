// i18next setup shared by the server instance (src/server/i18n.server.ts) and islands.
import i18next, { type TFunction } from "i18next";
import type basket from "../locales/en/basket.json";
import type site from "../locales/en/site.json";

/** The namespaces and their keys (English is the reference), for type-checked `t()` calls. */
export interface Namespaces {
  site: typeof site;
  basket: typeof basket;
}

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "site";
    resources: Namespaces;
  }
}

export const options = {
  fallbackLng: "en",
  // Synchronous init: resources are inline, so `t` works right after init().
  initAsync: false,
  // Lumiose escapes text when it renders it; escaping values here too would show `&amp;`.
  interpolation: { escapeValue: false },
} as const;

/**
 * A `t` for an island: an instance of its own with only the namespace the page sent as a prop, in
 * the page's locale. The same call renders on the server and runs again in the browser.
 */
export function islandT<NS extends keyof Namespaces>(
  locale: string,
  ns: NS,
  messages: Namespaces[NS],
): TFunction<NS> {
  const instance = i18next.createInstance({
    ...options,
    lng: locale,
    ns: [ns],
    defaultNS: ns,
    resources: { [locale]: { [ns]: messages } },
  });
  void instance.init();
  return instance.getFixedT(locale, ns);
}
