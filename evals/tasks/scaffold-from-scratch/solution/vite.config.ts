import lumiose from "lumiose/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [lumiose({ mode: "static" })],
});
