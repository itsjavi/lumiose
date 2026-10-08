// A minimal static file server for the e2e tests, behaving like a static host (GitHub Pages):
// `/docs/x` and `/docs/x/` serve `docs/x/index.html`, other files are served as they are, and unknown
// paths get the mount's `404.html` with status 404. No Lumen code runs at request time.
//
//   node e2e/serve.ts <port> <mount>=<dir> …     e.g. 5194 /lumen/=.lumen/e2e/base /=dist/client
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const [port = "5194", ...specs] = process.argv.slice(2);
// Longest mount first, so `/lumen/` wins over `/`.
const mounts = specs
  .map((spec) => {
    const [prefix = "/", dir = "dist/client"] = spec.split("=");
    return { prefix, root: resolve(dir) + sep };
  })
  .toSorted((a, b) => b.prefix.length - a.prefix.length);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

async function isFile(path: string): Promise<boolean> {
  return (await stat(path).catch(() => undefined))?.isFile() ?? false;
}

async function resolveFile(root: string, pathname: string): Promise<string | undefined> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const path = normalize(join(root, decoded));
  if (!path.startsWith(root) && `${path}${sep}` !== root) return undefined;
  if (!decoded.endsWith("/") && (await isFile(path))) return path;
  const index = join(path, "index.html");
  return (await isFile(index)) ? index : undefined;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const mount =
    mounts.find((m) => pathname.startsWith(m.prefix) || `${pathname}/` === m.prefix) ??
    mounts.at(-1)!;
  const file = await resolveFile(mount.root, pathname.slice(mount.prefix.length - 1) || "/");
  const body = file ?? join(mount.root, "404.html");
  response.writeHead(file === undefined ? 404 : 200, {
    "content-type": TYPES[extname(body)] ?? "application/octet-stream",
  });
  createReadStream(body).pipe(response);
}).listen(Number(port), "127.0.0.1", () => {
  console.log(`Serving ${mounts.map((m) => `${m.prefix} → ${m.root}`).join(", ")} on :${port}`);
});
