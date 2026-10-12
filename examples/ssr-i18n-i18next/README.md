# i18n: i18next

A small bakery site in English, Spanish and French, with Lumiose's locale routing and
[i18next](https://www.i18next.com). It follows the
[i18n guide](../../packages/lumiose/docs/guides/i18n.md); the
[Paraglide JS sample](../ssr-i18n-paraglide) is the same site with Paraglide.

- `vite.config.ts`: `lumiose({ i18n })` with `missing: "redirect"` and detection on entry (a
  `locale` cookie and `Accept-Language`).
- `src/locales/{locale}/{namespace}.json`: the translations, in two namespaces (`site` for the
  pages, `basket` for the island).
- `src/server/i18n.server.ts`: one server instance with every locale, and `getT()`, a `t` fixed to
  the request's locale (`getFixedT`). Server-only.
- `src/lib/i18n.ts`: the shared options, the typed keys (`CustomTypeOptions`) and `islandT()`.
- `/` exists in every locale; `/about` only in English and Spanish, so `/fr/about` redirects to
  `/about` and its `hreflang` links list two locales. `/about` is prerendered per locale, with
  absolute URLs from `lumiose({ site })`.
- `src/islands/Basket.stsx` gets the `basket` namespace in the page's locale as a prop and creates
  a small i18next instance from it.
- `src/islands/LocaleSwitcher.stsx` links to `alternates()` and updates the detection cookie.
- `src/routes/layout.stsx` links to `/about` in the current locale when `alternates("/about")`
  lists it, else in English.

## Run it

Node 24 or later.

```sh
pnpm --filter @lumiose-examples/ssr-i18n-i18next dev        # lumiose dev
pnpm --filter @lumiose-examples/ssr-i18n-i18next typecheck  # lumiose check (typed keys included)
pnpm --filter @lumiose-examples/ssr-i18n-i18next build      # lumiose build: dist/client + dist/server/entry.js
pnpm --filter @lumiose-examples/ssr-i18n-i18next start      # node server.ts: @lumiose/adapter-node on $PORT (3000)
pnpm --filter @lumiose-examples/ssr-i18n-i18next test:e2e   # Playwright, against the production build
```

The e2e tests (`e2e/i18n.e2e.ts`) cover localized pages with their `hreflang` and canonical links,
the redirect for an undeclared locale, the language switcher and the cookie it sets, detection on a
first visit, and the island's messages.
