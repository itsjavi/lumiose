// `createDevHandler()` (decision-52, TASK-300): the dev app mounted in the project's own Node server,
// with HMR's WebSocket on that server next to the project's own upgrades.
import { linkLumiose } from "../../test-links.ts";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLogger } from "vite";
import { createDevHandler, type DevHandler } from "./handler.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "src/routes/page.stsx": `export const mode = "server";
export default function Home() { return <h1>Home</h1>; }
`,
  "src/routes/boom/page.stsx": `export const mode = "server";
export default function Boom() { throw new Error("Boom in dev"); }
`,
};

let root: string;
let server: Server;
let handler: DevHandler;
let origin: string;
const upgrades: string[] = [];

function write(name: string, code: string): void {
  mkdirSync(dirname(join(root, name)), { recursive: true });
  writeFileSync(join(root, name), code);
}

beforeAll(async () => {
  if (!binding) return;
  root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-dev-handler-")));
  for (const [name, code] of Object.entries(FILES)) write(name, code);
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  server = createServer();
  handler = await createDevHandler({ root, server, customLogger: createLogger("silent") });
  server.on("request", handler);
  // The project's own upgrades, next to Vite's HMR on the same server.
  server.on("upgrade", (request, socket) => {
    if (request.url !== "/ws") return; // HMR is Vite's
    upgrades.push(request.url);
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await handler?.close();
  await new Promise((resolve) => server?.close(resolve));
  if (root) rmSync(root, { recursive: true, force: true });
});

/** Opens Vite's HMR socket on the project's server; resolves once Vite says `connected`. */
function hmr(): Promise<{ socket: WebSocket; messages: unknown[] }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(origin.replace("http", "ws"), "vite-hmr");
    const messages: unknown[] = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { type: string };
      messages.push(message);
      if (message.type === "connected") resolve({ socket, messages });
    });
    socket.addEventListener("error", () => reject(new Error("HMR socket failed")));
  });
}

async function eventually(check: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeout) throw new Error("Timed out");
    await new Promise((done) => setTimeout(done, 50));
  }
}

describe.skipIf(!binding)("createDevHandler()", () => {
  it("serves the app, Vite's client and the error overlay from the project's server", async () => {
    const page = await fetch(`${origin}/`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("<h1>Home</h1>");
    expect(html).toContain('<script type="module" src="/@vite/client">');
    const client = await fetch(`${origin}/@vite/client`);
    expect(client.headers.get("content-type")).toMatch(/javascript/);
    const boom = await fetch(`${origin}/boom`);
    expect(boom.status).toBe(500);
    expect(await boom.text()).toContain("Boom in dev");
  });

  it("runs HMR on the project's server, next to its own upgrades", async () => {
    const { socket, messages } = await hmr();
    const refused = await new Promise<string>((resolve) => {
      const other = new WebSocket(`${origin.replace("http", "ws")}/ws`);
      other.addEventListener("error", () => resolve("refused"));
      other.addEventListener("open", () => resolve("open"));
    });
    expect(refused).toBe("refused");
    expect(upgrades).toEqual(["/ws"]);
    // A server-only edit: the page patches itself (lumiose dev's server update).
    write(
      "src/routes/page.stsx",
      FILES["src/routes/page.stsx"]!.replace("<h1>Home</h1>", "<h1>Edited</h1>"),
    );
    await eventually(() =>
      messages.some(
        (message) =>
          (message as { type: string; event?: string }).event === "lumiose:server-update",
      ),
    );
    expect(await (await fetch(`${origin}/`)).text()).toContain("<h1>Edited</h1>");
    socket.close();
  });

  it("works as connect middleware, passing errors to next()", async () => {
    const errors: unknown[] = [];
    const response = await new Promise<number>((resolve) => {
      const probe = createServer((req, res) =>
        handler(req, res, (error) => {
          errors.push(error);
          res.statusCode = 599;
          res.end();
        }),
      );
      probe.listen(0, "127.0.0.1", async () => {
        const { port } = probe.address() as AddressInfo;
        const status = (await fetch(`http://127.0.0.1:${port}/`)).status;
        probe.close();
        resolve(status);
      });
    });
    expect(response).toBe(200);
    expect(errors).toEqual([]);
  });

  it("close() stops Vite and its HMR socket, and leaves the project's server open", async () => {
    const { socket } = await hmr();
    const closed = new Promise<void>((resolve) =>
      socket.addEventListener("close", () => resolve()),
    );
    await handler.close();
    await closed;
    expect(server.listening).toBe(true);
  });
});
