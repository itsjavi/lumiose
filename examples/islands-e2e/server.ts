// Dev SSR server for the islands fixture: Vite in middleware mode compiles the page for the server
// (its `ssr` environment) and serves the browser modules. Each page streams: the shell (with the
// island records), then the `<Suspense>` boundary that waits for the slow member.
//
// The page loads the island loader as `<script type="module" async src>`: `async`, so islands
// hydrate while the stream is still arriving. `lumiose/dom/loader` is served from its file through
// `/@fs/`, which is how a dev server can reference it.
import { createServer as createHttpServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, isRunnableDevEnvironment, normalizePath } from "vite";

const port = Number(process.env.PORT ?? 5193);
// `/@fs/D:/…` on Windows, `/@fs/home/…` elsewhere.
const loader = normalizePath(
  fileURLToPath(new URL("./src/dom/loader.ts", import.meta.resolve("lumiose/package.json"))),
).replace(/^\/?/, "/");

const vite = await createServer({
  root: import.meta.dirname,
  appType: "custom",
  server: { middlewareMode: true },
});
const ssr = vite.environments.ssr;
if (!isRunnableDevEnvironment(ssr)) throw new Error("Vite's ssr environment must be runnable");
const { runner } = ssr;

type Entry = typeof import("./src/entry-server.tsx");
type Api = typeof import("./src/api.ts");

async function handle(url: URL, res: ServerResponse): Promise<void> {
  if (url.pathname.startsWith("/api/member/")) {
    const { loadMember } = await runner.import<Api>("/src/api.ts");
    const member = await loadMember(url.pathname.slice("/api/member/".length));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(member));
    return;
  }
  if (url.pathname !== "/" && url.pathname !== "/draft") {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const { delays } = await runner.import<Api>("/src/api.ts");
  delays.slow = Number(url.searchParams.get("slow") ?? 600);
  const { render } = await runner.import<Entry>("/src/entry-server.tsx");
  // `.stsx` modules are Vite import URLs in dev (`?import`), as the island manifest imports them.
  const shell = await render({ islandUrl: (specifier) => `${specifier}?import` }, url.pathname);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Islands</title>${shell.head}` +
      `<script type="module" async src="/@fs${loader}"></script></head><body>${shell.body}`,
  );
  if (shell.stream !== null) {
    for await (const chunk of shell.stream) res.write(chunk);
  }
  res.end("</body></html>");
}

createHttpServer((req, res) => {
  vite.middlewares(req, res, () => {
    handle(new URL(req.url ?? "/", "http://localhost"), res).catch((error: Error) => {
      vite.ssrFixStacktrace(error);
      console.error(error);
      res.statusCode = 500;
      res.end(error.stack);
    });
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Islands fixture on http://127.0.0.1:${port}`);
});
