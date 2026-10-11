import { solidStart } from "@solidjs/start/config";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // SolidStart 2 renders every page on request (streaming SSR); Nitro builds the Node server.
  // Nitro does not compress responses (doc-4 §1) unless `compressPublicAssets` is set.
  plugins: [solidStart(), nitro({ preset: "node-server" })],
});
