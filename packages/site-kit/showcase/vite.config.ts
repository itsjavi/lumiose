import lumen from "lumen/vite";
import { defineConfig } from "vite";

// The showcase: a client-rendered page with every site-kit component (`pnpm --filter
// @lumen/site-kit dev`). It imports the kit's sources directly.
export default defineConfig({
  plugins: [lumen()],
});
