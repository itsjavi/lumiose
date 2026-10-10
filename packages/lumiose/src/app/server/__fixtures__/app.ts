// A request handler over in-memory modules, for handler tests. Modules are keyed by
// project-relative path; `src/routes/**` files become the route manifest.

import { expect, vi } from "vitest";
import { createRouteManifest } from "../../routes/manifest.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "../handler.ts";
import { createStringRenderer } from "./string-renderer.ts";

// Test components take loosely typed props, like compiled components.
export type Props = any;
export type Modules = Record<string, ModuleExports>;

const ROUTES = "src/routes/";

/** A fetch handler over in-memory modules; `fetch(path)` resolves paths against https://lumiose.test. */
export function app(modules: Modules, options: Partial<RequestHandlerOptions> = {}) {
  const manifest = createRouteManifest(
    Object.keys(modules)
      .filter((file) => file.startsWith(ROUTES))
      .map((file) => ({ path: file.slice(ROUTES.length), source: "" })),
  );
  expect(manifest.diagnostics).toEqual([]);
  const onError = vi.fn();
  // The production entry is `export default { fetch }`, so fetch must work unbound.
  const { fetch: handle } = createRequestHandler({
    manifest,
    loadModule: async (file) => {
      const module = modules[file];
      if (module === undefined) throw new Error(`no module ${file}`);
      return module;
    },
    render: createStringRenderer(),
    onError,
    ...("src/middleware.ts" in modules ? { middleware: "src/middleware.ts" } : {}),
    ...options,
  });
  const fetch = (path: string, init?: RequestInit) =>
    handle(new Request(new URL(path, "https://lumiose.test"), init));
  return { fetch, handle, onError };
}

export const page = (render: (props: Props) => unknown): ModuleExports => ({ default: render });

export const layout = (tag: string): ModuleExports =>
  page(async ({ children }) => `<${tag}>${await children}</${tag}>`);
