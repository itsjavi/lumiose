// Dev SSR server for the islands fixture: Vite in middleware mode compiles the page for the server
// (its `ssr` environment) and serves the browser modules. Each page streams: the shell (with the
// island records), then the `<Suspense>` boundary that waits for the slow member.
//
// The page loads the island loader as `<script type="module" async src>`: `async`, so islands
// hydrate while the stream is still arriving. `lumen/dom/loader` is served from its file through
// `/@fs/`, which is how a dev server can reference it.
import { createServer as createHttpServer, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer, isRunnableDevEnvironment } from "vite";

const port = Number(process.env.PORT ?? 5193);
const loader = fileURLToPath(new URL("./src/dom/loader.ts", import.meta.resolve("lumen/package.json")));

const vite = await createServer({
  root: import.meta.dirname,
  appType: "custom",
  server: { middlewareMode: true },
});
const ssr = vite.environments.ssr;
if (!isRunnableDevEnvironment(ssr)) throw new Error("Vite's ssr environment must be runnable");

type Entry = typeof import("./src/entry-server.tsx");
type Api = typeof import("./src/api.ts");

async function handle(url: URL, res: ServerResponse): Promise<void> {
  if (url.pathname.startsWith("/api/member/")) {
    const { loadMember } = await ssr.runner.import<Api>("/src/api.ts");
    const member = await loadMember(url.pathname.slice("/api/member/".length));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(member));
    return;
  }
  if (url.pathname !== "/") {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const { render } = await ssr.runner.import<Entry>("/src/entry-server.tsx");
  // `.stsx` modules are Vite import URLs in dev (`?import`), as the island manifest imports them.
  const shell = await render({ islandUrl: (specifier) => `${specifier}?import` });
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
