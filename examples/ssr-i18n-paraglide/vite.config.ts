import { paraglideVitePlugin } from "@inlang/paraglide-js";
import lumiose from "@lumiose/vite";

export default {
  plugins: [
    // Compiles messages/{locale}.json into src/paraglide (a function per message, and the runtime)
    // when dev and build start, and again when a message file changes.
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      emitTsDeclarations: true,
    }),
    lumiose({
      mode: "server",
      i18n: {
        locales: ["en", "es", "fr"],
        defaultLocale: "en",
        missing: "404",
        detect: { cookie: "locale", acceptLanguage: true },
      },
      // The origin of the absolute hreflang and canonical URLs of prerendered pages (/about).
      site: "https://bakery.example",
    }),
  ],
};
