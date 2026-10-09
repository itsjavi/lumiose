// Serves the static results viewer: benchmarks/fullstack/viewer/ at /, results/ at /results/.
//   pnpm --filter @bench/harness run view [--port 4100]   (`run`: `pnpm view` is a built-in)
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { FULLSTACK } from "./apps.ts";
import { args } from "./cli.ts";
import { writeIndex } from "./results.ts";

const values = args({ port: { type: "string", default: "4100" } });
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

if (existsSync(join(FULLSTACK, "results"))) writeIndex();

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const file = relative.startsWith("/results/")
    ? join(FULLSTACK, relative)
    : join(FULLSTACK, "viewer", relative === "/" ? "index.html" : relative);
  if (!file.startsWith(FULLSTACK) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(response);
}).listen(Number(values.port), "127.0.0.1", () => {
  console.log(`Results viewer: http://127.0.0.1:${values.port}/`);
});
