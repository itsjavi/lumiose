// Deploy adapters (decision-45, TASK-175): `lumiose({ adapter: cloudflare() })`. After prerendering,
// `lumiose build` calls the adapter's `adapt()`, which writes the platform's output from `dist/`.
// The adapter packages (@lumiose/adapter-cloudflare, -vercel, -netlify) create these objects; the
// interface is internal to Lumiose's packages. Without an adapter the output is the Node build,
// which `@lumiose/adapter-node`, Bun and Deno serve.

import type { Logger } from "vite";
import type { BuiltAppConfig } from "lumiose/internal/app/server/app.ts";
import type { PrerenderedFile } from "./prerender.ts";

export interface Adapter {
  /** The adapter package, for messages: `"@lumiose/adapter-cloudflare"`. */
  readonly name: string;
  /**
   * `"platform"` when the platform serves `dist/client` itself, before calling the function, and
   * compresses on its own: the server entry then leaves out its static file layer (and with it
   * `node:fs`), and the build writes no `.br`/`.gz` copies. Default: the server entry serves them.
   */
  readonly staticFiles?: "platform";
  /** Writes the platform's output. Runs once the build, prerendering included, is complete. */
  adapt(build: AdapterBuild): void | Promise<void>;
}

/** What `adapt()` gets: the finished build. */
export interface AdapterBuild {
  /** Absolute project root. */
  readonly root: string;
  /** Absolute output directory (`dist`). */
  readonly outDir: string;
  /** Absolute `dist/client`: assets, `public/` and prerendered files. */
  readonly clientDir: string;
  /** Absolute `dist/server/entry.js`; undefined when every route is prerendered. */
  readonly serverEntry: string | undefined;
  /** The build's `config` export: `base`, `trailingSlash`, `assetsDir` and `headers`. */
  readonly config: BuiltAppConfig;
  /** Prerendered files, relative to `clientDir`. */
  readonly prerendered: readonly PrerenderedFile[];
  /** Vite's mode (`production`). */
  readonly mode: string;
  /** Vite's logger: report what was written with `logger.info`. */
  readonly logger: Logger;
}

/** Whether `value` looks like an adapter: `lumiose({ adapter })` validates it with this. */
export function isAdapter(value: unknown): value is Adapter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Adapter).name === "string" &&
    typeof (value as Adapter).adapt === "function" &&
    ((value as Adapter).staticFiles === undefined || (value as Adapter).staticFiles === "platform")
  );
}
