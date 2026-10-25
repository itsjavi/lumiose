// Regression tests of @lumiose/stsx's React Router guard, against the installed React Router: a
// route module in `.stsx` stops the build and dev server rendering. The export check (a `loader`,
// React Router's public route API) and the second layer, which spots React Router's own route
// imports (its internal module ids and queries), are each tested on their own, so a React Router
// upgrade that renames those internals fails here instead of silently letting a route through.
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuilder, createLogger, createServer } from "vite";
import { afterEach, expect, it } from "vitest";

const example = fileURLToPath(new URL(".", import.meta.url));
const apps: string[] = [];

/** A copy of the example (inside it, for its node_modules) whose about route is `about.stsx`. */
function appWithStsxRoute(route: string): string {
  const root = mkdtempSync(join(example, ".tmp-guard-"));
  apps.push(root);
  for (const path of ["app", "react-router.config.ts", "vite.config.ts"]) {
    cpSync(join(example, path), join(root, path), { recursive: true });
  }
  writeFileSync(join(root, "app/routes/about.stsx"), route);
  rmSync(join(root, "app/routes/about.tsx"));
  writeFileSync(
    join(root, "app/routes.ts"),
    'import { type RouteConfig, index, route } from "@react-router/dev/routes";\n\n' +
      'export default [index("routes/home.tsx"), route("about", "routes/about.stsx")] satisfies RouteConfig;\n',
  );
  return root;
}

afterEach(() => {
  for (const root of apps.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function buildApp(root: string): Promise<void> {
  const builder = await createBuilder({
    root,
    configFile: join(root, "vite.config.ts"),
    logLevel: "silent",
  });
  await builder.buildApp();
}

const WITH_LOADER = `export function loader() {
  return { message: "hi" };
}

export default function About() {
  return <p className="about">about</p>;
}

<style>
  .about { margin: 0; }
</style>
`;

const WITHOUT_ROUTE_EXPORTS = `export default function About() {
  return <p className="about">about</p>;
}

<style>
  .about { margin: 0; }
</style>
`;

it("stops the build at a .stsx route module", async () => {
  await expect(buildApp(appWithStsxRoute(WITH_LOADER))).rejects.toThrow(
    /about\.stsx: a React Router route module cannot be a \.stsx file/,
  );
});

it("rejects a .stsx route module with a loader when the browser loads it in dev", async () => {
  // The browser imports route modules by URL, without React Router's route imports: only the
  // export check sees this path.
  const root = appWithStsxRoute(WITH_LOADER);
  const server = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    customLogger: createLogger("silent"),
    server: { middlewareMode: true, ws: false, watch: null },
  });
  try {
    await expect(
      server.environments.client.transformRequest("/app/routes/about.stsx"),
    ).rejects.toThrow(
      /about\.stsx: a React Router route module cannot be a \.stsx file \(it exports `loader`/,
    );
  } finally {
    await server.close();
  }
});

it("stops the build at a .stsx route module without route exports (React Router's route imports)", async () => {
  await expect(buildApp(appWithStsxRoute(WITHOUT_ROUTE_EXPORTS))).rejects.toThrow(
    /about\.stsx: a React Router route module cannot be a \.stsx file \(React Router imports it/,
  );
});

it("stops dev server rendering at a .stsx route module without route exports", async () => {
  const root = appWithStsxRoute(WITHOUT_ROUTE_EXPORTS);
  const server = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    customLogger: createLogger("silent"),
    server: { middlewareMode: true, ws: false, watch: null },
  });
  try {
    await expect(
      server.environments.ssr.runner.import("virtual:react-router/server-build"),
    ).rejects.toThrow(/a React Router route module cannot be a \.stsx file/);
  } finally {
    await server.close();
  }
});
