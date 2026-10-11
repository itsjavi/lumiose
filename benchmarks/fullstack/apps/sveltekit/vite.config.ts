import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit({
      // doc-4 §1: no HTTP compression, so no precompressed .br/.gz assets either.
      adapter: adapter({ precompress: false }),
      paths: {
        // adapter-node assumes https without a proxy's protocol header; the benchmark serves plain
        // http on 127.0.0.1, and form actions check the request's origin against this one.
        origin: process.env.ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 4105}`,
      },
    }),
  ],
});
