import lumiose from "@lumiose/vite";

export default {
  plugins: [
    lumiose({
      mode: "server",
      i18n: {
        locales: ["en", "es", "fr"],
        defaultLocale: "en",
        missing: "redirect",
        detect: { cookie: "locale", acceptLanguage: true },
      },
      // The origin of the absolute hreflang and canonical URLs of prerendered pages (/about).
      site: "https://bakery.example",
    }),
  ],
};
