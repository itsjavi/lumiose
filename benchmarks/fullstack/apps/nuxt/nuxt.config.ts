// Nuxt 4 renders every page on request (no prerendering, no route caching); Nitro builds the
// node-server output. Nitro does not compress responses (doc-4 §1): `compressPublicAssets` stays
// off, so there are no precompressed assets either.
export default defineNuxtConfig({
  compatibilityDate: "2026-10-01",
  devtools: { enabled: true },
  telemetry: false,
  css: ["@bench/ui-css/tracker.css"],
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      titleTemplate: "%s · Tracker",
    },
  },
  nitro: { preset: "node-server", compressPublicAssets: false },
});
