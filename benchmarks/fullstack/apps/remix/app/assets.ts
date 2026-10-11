import { createAssetServer } from "remix/assets";
import { componentHmr } from "remix/component-hmr/assets";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR);

// Remix 3 has no build step: the asset server compiles browser modules and CSS on request. In
// production it minifies them and serves content-fingerprinted URLs (immutable caching), which
// needs `watch: false`; in development it watches the sources and pushes HMR updates.
export const assets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  // The default mounts, plus the benchmark's shared stylesheet (a workspace package outside the
  // app, so outside the `node_modules` mount).
  mounts: { app: "app", npm: "node_modules", "ui-css": "../../packages/ui-css" },
  allowFiles: ["app/routes.ts", "app/**/public/**", "../../packages/ui-css/tracker.css"],
  allowPackages: ["remix"],
  denyFiles: ["app/**/*.test.*"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import("remix/node-hmr/runtime")).createBrowserHmrChannel(),
        moduleImporter: "remix/multiple-import-maps-polyfill",
      }
    : undefined,
  scripts: { loaders: isHmr ? [componentHmr()] : undefined },
});

export const scriptEntry = await assets.getScriptEntry("app/actions/public/entry.ts");

/** The shared stylesheet of every Tracker app (doc-4 §1). */
export const stylesHref = await assets.getHref("../../packages/ui-css/tracker.css");
