import { reactRouter } from "@react-router/dev/vite";
import stsx from "@lumiose/stsx";
import { defineConfig } from "vite";

export default defineConfig({
  // @lumiose/stsx goes before React Router: it turns .stsx components into TSX for it.
  plugins: [stsx({ classAttribute: "className" }), reactRouter()],
});
