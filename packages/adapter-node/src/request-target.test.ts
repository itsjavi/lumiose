// Request targets (TASK-164): only `/path` targets are served, and `//host/…` stays a path for
// the static files and for the app (raw sockets: fetch() never sends such targets).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHandler } from "./server.ts";

let dir: string;
let server: Server;
let port: number;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "lumiose-target-"));
  mkdirSync(join(dir, "server"), { recursive: true });
  mkdirSync(join(dir, "client"), { recursive: true });
  writeFileSync(join(dir, "client", "index.html"), "<h1>home</h1>");
  writeFileSync(join(dir, "client", "robots.txt"), "User-agent: *");
  writeFileSync(
    join(dir, "server", "entry.js"),
    `export const config = { base: "/", trailingSlash: "ignore", assetsDir: "assets" };
const handler = { fetch: (request) => new Response("app " + request.url) };
export const createHandler = () => handler;
export default handler;
`,
  );
  const handler = await createHandler({ dir, origin: "https://victim.test" });
  server = createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

function raw(line: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () =>
      socket.write(`${line}\r\nHost: victim.test\r\nConnection: close\r\n\r\n`),
    );
    let out = "";
    socket.on("data", (chunk) => (out += chunk));
    socket.on("error", reject);
    socket.on("end", () => resolve({ status: Number(out.split(" ")[1]), text: out }));
  });
}

describe("request targets", () => {
  it("serves //robots.txt neither as the home page nor as another host", async () => {
    const response = await raw("GET //robots.txt HTTP/1.1");
    expect(response.text).not.toContain("<h1>home</h1>");
    expect(response.text).toContain("app https://victim.test//robots.txt");
  });

  it("sends Lumiose's default headers on static files and app responses (decision-29)", async () => {
    for (const path of ["/robots.txt", "/page"]) {
      const response = await raw(`GET ${path} HTTP/1.1`);
      expect(response.text).toMatch(/x-content-type-options: nosniff/i);
      expect(response.text).toMatch(/referrer-policy: strict-origin-when-cross-origin/i);
    }
  });

  it("answers 400 to absolute-form targets, without reaching the app", async () => {
    const response = await raw("GET http://attacker.test/ HTTP/1.1");
    expect(response.status).toBe(400);
    expect(response.text).not.toContain("app ");
  });
});
