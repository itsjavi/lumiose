// The Origin check against cross-site form posts (decision-18), as properties (decision-56,
// TASK-313): a browser request from another site never passes, same-host requests and clients
// without browser headers do, and through the handler a refused post never runs the action.
import { describe, expect, it, vi } from "vitest";
import { fc, RUNS } from "./__fixtures__/property.ts";
import { app } from "./__fixtures__/app.ts";
import { isSameOriginRequest, needsOriginCheck } from "./csrf.ts";

const hostArb = fc.domain();
const schemeArb = fc.constantFrom("http", "https");
const portArb = fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined });
const originOf = (scheme: string, host: string, port: number | undefined) =>
  new URL(`${scheme}://${host}${port === undefined ? "" : `:${port}`}`).origin;

const post = (url: string, headers: Record<string, string>) =>
  new Request(url, { method: "POST", headers });

describe("isSameOriginRequest()", () => {
  it("refuses a browser request whose Origin is another host, unless that origin is allowed", () => {
    fc.assert(
      fc.property(
        schemeArb,
        hostArb,
        portArb,
        schemeArb,
        hostArb,
        portArb,
        fc.boolean(),
        (scheme, host, port, fromScheme, fromHost, fromPort, allow) => {
          const url = new URL(originOf(scheme, host, port));
          const origin = originOf(fromScheme, fromHost, fromPort);
          fc.pre(new URL(origin).host !== url.host);
          const allowed = new Set(allow ? [origin] : []);
          expect(isSameOriginRequest(post(url.href, { origin }), url, allowed)).toBe(allow);
        },
      ),
    );
  });

  it("accepts the same host over either scheme (a proxy may terminate TLS)", () => {
    fc.assert(
      fc.property(schemeArb, schemeArb, hostArb, portArb, (scheme, fromScheme, host, port) => {
        const url = new URL(originOf(scheme, host, port));
        const origin = `${fromScheme}://${url.host}`;
        expect(isSameOriginRequest(post(url.href, { origin }), url, new Set())).toBe(true);
      }),
    );
  });

  it("trusts Sec-Fetch-Site over Origin: only same-origin and none pass", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("same-origin", "same-site", "cross-site", "none", "garbage"),
        fc.option(fc.string(), { nil: undefined }),
        (site, origin) => {
          const url = new URL("https://app.test/");
          const headers: Record<string, string> = { "sec-fetch-site": site };
          if (origin !== undefined) {
            try {
              headers.origin = new Headers({ origin }).get("origin")!;
            } catch {
              // Not a valid header value: a browser cannot send it.
            }
          }
          expect(isSameOriginRequest(post(url.href, headers), url, new Set())).toBe(
            site === "same-origin" || site === "none",
          );
        },
      ),
    );
  });

  it("never throws, and passes a malformed Origin only when it names the request's host", () => {
    fc.assert(
      fc.property(fc.string(), (origin) => {
        let request: Request;
        try {
          request = post("https://app.test/", { origin });
        } catch {
          return; // a value no client can send
        }
        const url = new URL("https://app.test/");
        const passed = isSameOriginRequest(request, url, new Set());
        let host: string | undefined;
        try {
          host = new URL(request.headers.get("origin")!).host;
        } catch {
          host = undefined;
        }
        expect(passed).toBe(host === "app.test");
      }),
    );
  });
});

describe("needsOriginCheck()", () => {
  it("checks every unsafe page request, and endpoint bodies a cross-site form could send", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"),
        fc.boolean(),
        fc.constantFrom(
          "",
          "application/x-www-form-urlencoded",
          "Multipart/Form-Data; boundary=x",
          "text/plain;charset=utf-8",
          "application/json",
          "application/xml",
        ),
        (method, isPage, type) => {
          const request = new Request("https://app.test/", {
            method,
            headers: type === "" ? {} : { "content-type": type },
          });
          const safe = method === "GET" || method === "HEAD" || method === "OPTIONS";
          const formLike = !/^application\/(?:json|xml)/.test(type);
          expect(needsOriginCheck(request, isPage)).toBe(!safe && (isPage || formLike));
        },
      ),
    );
  });
});

describe("the handler", () => {
  it("never runs a page action for a cross-site form post", async () => {
    const action = vi.fn(() => ({ ok: true }));
    const { handle } = app({
      "src/routes/page.stsx": { default: () => "<h1>home</h1>", actions: { save: action } },
    });
    await fc.assert(
      fc.asyncProperty(
        hostArb.filter((host) => host !== "lumiose.test"),
        schemeArb,
        fc.constantFrom("cross-site", "same-site", undefined),
        fc.boolean(),
        async (host, scheme, site, enhanced) => {
          const headers: Record<string, string> = {
            origin: `${scheme}://${host}`,
            "content-type": "application/x-www-form-urlencoded",
            ...(site === undefined ? {} : { "sec-fetch-site": site }),
            ...(enhanced ? { accept: "application/json", "x-lumiose-action": "1" } : {}),
          };
          const response = await handle(
            new Request("https://lumiose.test/?/save", { method: "POST", headers, body: "a=1" }),
          );
          expect(response.status).toBe(403);
          if (enhanced) expect(await response.json()).toMatchObject({ type: "error", status: 403 });
        },
      ),
      { numRuns: Math.max(10, Math.floor(RUNS / 4)) },
    );
    expect(action).not.toHaveBeenCalled();
  });
});
