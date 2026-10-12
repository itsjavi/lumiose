// The server build's `export default { fetch }` (./serve.ts, decision-45): static files first, then
// the app with `ctx.platform`, and `lumiose({ headers })` on every response.
import { describe, expect, it } from "vitest";
import type { Platform } from "./context.ts";
import type { RequestHandler } from "./handler.ts";
import { serveBuild, type StaticFiles } from "./serve.ts";

const config = { base: "/", headers: { "x-frame-options": "DENY" } };

/** An app that answers with the platform it was given. */
function recordingApp() {
  const platforms: (Partial<Platform> | undefined)[] = [];
  const app: RequestHandler = {
    fetch: async (_request, platform) => {
      platforms.push(platform);
      return new Response("app");
    },
  };
  return { app, platforms };
}

const statics: StaticFiles = async (request, url) =>
  url.pathname === "/robots.txt" && request.method === "GET"
    ? new Response("User-agent: *", { headers: { "cache-control": "public, max-age=0" } })
    : undefined;

describe("serveBuild", () => {
  it("serves static files first, then the app", async () => {
    const { app } = recordingApp();
    const { fetch } = serveBuild(app, config, statics);
    expect(await (await fetch(new Request("http://x.test/robots.txt"))).text()).toBe(
      "User-agent: *",
    );
    expect(
      await (await fetch(new Request("http://x.test/robots.txt", { method: "POST" }))).text(),
    ).toBe("app");
    expect(await (await fetch(new Request("http://x.test/page"))).text()).toBe("app");
  });

  it("sends lumiose({ headers }) and Lumiose's defaults; a response's own headers win", async () => {
    const app: RequestHandler = {
      fetch: async () => new Response("app", { headers: { "referrer-policy": "no-referrer" } }),
    };
    const { fetch } = serveBuild(app, config, statics);
    const page = await fetch(new Request("http://x.test/page"));
    expect(page.headers.get("x-frame-options")).toBe("DENY");
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(page.headers.get("referrer-policy")).toBe("no-referrer");
    const file = await fetch(new Request("http://x.test/robots.txt"));
    expect(file.headers.get("x-frame-options")).toBe("DENY");
    expect(file.headers.get("cache-control")).toBe("public, max-age=0");
  });

  it("copies responses whose headers are immutable", async () => {
    const app: RequestHandler = { fetch: async () => Response.redirect("http://x.test/b", 302) };
    const res = await serveBuild(app, config).fetch(new Request("http://x.test/a"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://x.test/b");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("leaves paths outside base to the app, without the configured headers", async () => {
    const { app } = recordingApp();
    const { fetch } = serveBuild(app, { base: "/docs/", headers: config.headers });
    const outside = await fetch(new Request("http://x.test/other"));
    expect(outside.headers.get("x-frame-options")).toBeNull();
    const inside = await fetch(new Request("http://x.test/docs/a"));
    expect(inside.headers.get("x-frame-options")).toBe("DENY");
  });

  it("passes a platform through as ctx.platform", async () => {
    const { app, platforms } = recordingApp();
    const platform = { clientAddress: "198.51.100.1", env: {} };
    await serveBuild(app, config).fetch(new Request("http://x.test/"), platform);
    await serveBuild(app, config).fetch(new Request("http://x.test/"));
    expect(platforms).toEqual([platform, undefined]);
  });

  it("recognizes workerd's (request, env, ctx)", async () => {
    const { app, platforms } = recordingApp();
    const env = { KV: {} };
    const waited: Promise<unknown>[] = [];
    const context = {
      waitUntil(this: unknown, promise: Promise<unknown>) {
        expect(this).toBe(context);
        waited.push(promise);
      },
    };
    const request = new Request("http://x.test/", { headers: { "cf-connecting-ip": "192.0.2.4" } });
    await serveBuild(app, config).fetch(request, env, context);
    expect(platforms[0]).toMatchObject({ env, clientAddress: "192.0.2.4" });
    const work = Promise.resolve();
    platforms[0]!.waitUntil!(work);
    expect(waited).toEqual([work]);
  });

  it("recognizes Bun's server and Deno's handler info", async () => {
    const { app, platforms } = recordingApp();
    const request = new Request("http://x.test/");
    const bunServer = {
      requestIP: (req: Request) => (req === request ? { address: "10.0.0.1", port: 1 } : null),
    };
    await serveBuild(app, config).fetch(request, bunServer);
    const denoInfo = { remoteAddr: { transport: "tcp", hostname: "10.0.0.2", port: 2 } };
    await serveBuild(app, config).fetch(request, denoInfo);
    expect(platforms).toEqual([{ clientAddress: "10.0.0.1" }, { clientAddress: "10.0.0.2" }]);
  });
});
