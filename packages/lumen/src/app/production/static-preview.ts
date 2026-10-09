// The Vite preview plugin of `lumen preview` for builds without `dist/server` (TASK-125): sends
// `lumen({ headers })`, and answers unknown URLs with `404.html` and status 404, as static hosts do
// (an SPA shell there starts the client router for deep links).

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import type { Plugin } from "vite";
import { headersFor, pathBelowBase, type HeadersOption } from "../headers.ts";

export function staticPreviewPlugin(
  clientDir: string,
  headers: () => HeadersOption | undefined,
): Plugin {
  return {
    name: "lumen:static-preview",
    configurePreviewServer(server) {
      const base = server.config.base;
      // Before Vite's static files, so they get the headers too.
      server.middlewares.use((req, res, next) => {
        const option = headers();
        const path = pathBelowBase(req.url ?? "/", base);
        if (path !== undefined) {
          for (const [name, value] of Object.entries(headersFor(option, path))) {
            res.setHeader(name, value);
          }
        }
        next();
      });
      // After Vite's files and its page fallback: `about/index.html` for `/about` (prerendered
      // pages with trailingSlash "ignore"), else an unknown URL.
      return () => {
        server.middlewares.use((req, res, next) => {
          const [path = "/", query = ""] = (req.url ?? "/").split("?", 2);
          const isFile = (name: string) => {
            const file = join(clientDir, decodeURIComponent(name));
            // Never outside dist/client (`/../`).
            if (!file.startsWith(clientDir + sep)) return false;
            return existsSync(file) && statSync(file).isFile();
          };
          if (path.endsWith(".html") && isFile(path)) return next();
          const index = `${path.replace(/\/$/, "")}/index.html`;
          if (isFile(index)) {
            req.url = query === "" ? index : `${index}?${query}`;
            return next();
          }
          const notFound = join(clientDir, "404.html");
          if (!existsSync(notFound) || (req.method !== "GET" && req.method !== "HEAD")) {
            return next();
          }
          res.statusCode = 404;
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(req.method === "HEAD" ? undefined : readFileSync(notFound));
        });
      };
    },
  };
}
