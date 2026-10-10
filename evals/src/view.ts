// Serves the eval results viewer: evals/viewer/ at /, evals/results/ at /results/.
//   pnpm --filter @lumiose/evals run view [--port 4110]   (`run`: `pnpm view` is a pnpm built-in)
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { parseArgs } from "node:util";
import { EVALS } from "./workspace.ts";

const { values } = parseArgs({ options: { port: { type: "string", default: "4110" } } });
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const file = relative.startsWith("/results/")
    ? join(EVALS, relative)
    : join(EVALS, "viewer", relative === "/" ? "index.html" : relative);
  if (!file.startsWith(EVALS) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-cache",
  });
  createReadStream(file).pipe(response);
}).listen(Number(values.port), "127.0.0.1", () => {
  console.log(`Eval results viewer: http://127.0.0.1:${values.port}/`);
});
