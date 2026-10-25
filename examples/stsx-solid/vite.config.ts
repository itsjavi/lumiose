/// <reference types="vitest/config" />
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  // @lumiose/stsx goes before the framework's plugin: it turns .stsx into TSX for it.
  plugins: [stsx({ classAttribute: "class" }), solid()],
  // The smoke test builds with Vite in Node (vite-plugin-solid would pick jsdom).
  test: { environment: "node", exclude: ["node_modules/**", "dist/**"] },
});
