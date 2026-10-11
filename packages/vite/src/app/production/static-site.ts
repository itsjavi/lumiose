// Whether a build needs its server (TASK-125): a site whose every route is prerendered deploys with
// `dist/client` alone, so `lumiose build` removes `dist/server` and `lumiose preview` serves the files.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasActions } from "lumiose/internal/app/server/actions.ts";
import type { ServerEntryModule } from "./prerender.ts";

/**
 * Why the app needs a server, or `undefined` when `dist/client` is the whole site: no `server`
 * route, no `spa` route rendered on the server per request (`ssr` without `prerender`), no form
 * action, and `spa` shells with params covered by a `404.html` shell (static hosts serve it for
 * unknown URLs).
 */
export async function serverReason(
  entry: ServerEntryModule,
  clientDir: string,
): Promise<string | undefined> {
  for (const route of entry.app.manifest.routes) {
    if (route.mode === "server") return `${route.file} is a server route`;
    if (route.kind === "endpoint") continue;
    if (route.mode === "spa" && !route.prerender) {
      if (route.ssr) return `${route.file} renders an SPA on the server (ssr)`;
      if (route.params.length > 0 && !existsSync(join(clientDir, "404.html"))) {
        return `${route.file} has params and no 404.html shell serves it`;
      }
      continue;
    }
    if (hasActions(await entry.app.loadModule(route.file))) {
      return `${route.file} has form actions`;
    }
  }
  return undefined;
}
