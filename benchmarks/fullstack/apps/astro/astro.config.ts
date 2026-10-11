import node from "@astrojs/node";
import preact from "@astrojs/preact";
import { defineConfig } from "astro/config";

export default defineConfig({
  // Every page renders on demand (doc-4 §1: no prerendering, no page cache).
  output: "server",
  // The standalone server of @astrojs/node does not compress responses (doc-4 §1).
  adapter: node({ mode: "standalone" }),
  // The interactive parts are Preact islands (doc-4 §8).
  integrations: [preact()],
  server: { host: "127.0.0.1", port: 4108 },
});
