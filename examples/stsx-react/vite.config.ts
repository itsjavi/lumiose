/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({
  // @lumiose/stsx goes before the framework's plugin: it turns .stsx into TSX for it.
  plugins: [stsx({ classAttribute: "className", scopedStyles: { strategy: "class" } }), react()],
  test: { exclude: ["node_modules/**", "dist/**"] },
});
