/// <reference types="vitest/config" />
import { resolve } from "node:path";
import lumiose from "@lumiose/vite";
import { defineConfig, type Plugin } from "vite";

// TASK-332 option (c), "merge Timeless into this monorepo": with TIMELESS_SRC set to a checkout of
// the Timeless repository, its packages resolve to their TypeScript sources instead of the npm
// build, as workspace packages would after a merge.
function timelessFromSource(root: string): Plugin {
  const source = (path: string) => resolve(root, "packages", path);
  return {
    name: "timeless-from-source",
    enforce: "pre",
    resolveId(id) {
      const css = /^@timelessui\/components\/css\/(.*)$/.exec(id);
      if (css) return source(`components/src/css/${css[1]}`);
      const register = /^@timelessui\/components\/register\/(.*)$/.exec(id);
      // Timeless's package.json lists only `dist/` files as side effects, so the bundler would drop
      // the source `register/*` modules: mark them by hand.
      if (register)
        return { id: source(`components/src/register/${register[1]}.ts`), moduleSideEffects: true };
      const pkg = /^@timelessui\/(core|color)$/.exec(id);
      if (pkg) return source(`${pkg[1]}/src/index.ts`);
      return null;
    },
  };
}

const timelessSource = process.env.TIMELESS_SRC;

export default defineConfig({
  plugins: [
    ...(timelessSource ? [timelessFromSource(timelessSource)] : []),
    lumiose({ mode: "server" }),
  ],
  // The browser tests run with Playwright (`pnpm test:e2e`), not Vitest.
  test: { include: [], passWithNoTests: true },
});
