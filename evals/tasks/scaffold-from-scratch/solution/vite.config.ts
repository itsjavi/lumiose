import lumen from "lumen/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumen({ mode: "static" })],
});
