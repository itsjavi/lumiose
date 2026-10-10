// A minimal static file server for dist/client, behaving like a typical static host: `/about`
// and `/about/` serve `about/index.html`, other files are served as they are, and unknown paths
// get `404.html` with status 404. No Lumiose code runs: the build output is plain files.
//
//   pnpm build && pnpm serve        # PORT (4321) and HOST (127.0.0.1) are configurable
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("dist/client/", import.meta.url));
const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? "127.0.0.1";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

async function isFile(path: string): Promise<boolean> {
  return (await stat(path).catch(() => undefined))?.isFile() ?? false;
}

/** The file for a URL path: the file itself, else its `index.html`; `undefined` when missing. */
async function resolveFile(pathname: string): Promise<string | undefined> {
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

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" }).end();
    return;
  }
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const file = await resolveFile(pathname);
  const status = file === undefined ? 404 : 200;
  const body = file ?? join(root, "404.html");
  response.writeHead(status, {
    "content-type": TYPES[extname(body)] ?? "application/octet-stream",
    "cache-control": body.includes(`${sep}assets${sep}`)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(body).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Serving dist/client on http://${host}:${port}`);
});
