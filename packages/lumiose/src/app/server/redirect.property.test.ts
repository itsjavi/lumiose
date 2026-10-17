// Redirect targets (TASK-164, TASK-165), as properties (decision-56, TASK-313): `redirect()` only
// lets through locations a browser resolves to an http(s) URL, the trailing-slash and
// missing-translation redirects never leave the site, and a Node request target never names
// another host.
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { resolveI18n } from "../i18n/config.ts";
import { fc, RUNS } from "./__fixtures__/property.ts";
import { app, page } from "./__fixtures__/app.ts";
import { isRedirect, redirect } from "./control.ts";
import { requestTarget } from "./node-http.ts";

const ORIGIN = "https://app.test";

/** Strings shaped like URLs that try to smuggle a scheme: noise around and inside it. */
const schemeLike = fc
  .tuple(
    fc
      .array(fc.constantFrom("\0", "\x01", "\x1f", " ", "\t", "\n", "\r"), { maxLength: 3 })
      .map((chars) => chars.join("")),
    fc.constantFrom("javascript", "vbscript", "data", "file", "http", "https", "blob", "x-y.z+1"),
    fc.array(fc.nat(12), { maxLength: 2 }),
    fc.constantFrom("\t", "\n", "\r", " ", "\0"),
    fc.boolean(),
    fc.constantFrom(":", "%3A", "&#58;", "：", ""),
    fc.string(),
  )
  .map(([prefix, scheme, cuts, noise, upper, colon, rest]) => {
    let name = upper ? scheme.toUpperCase() : scheme;
    for (const cut of cuts) name = name.slice(0, cut) + noise + name.slice(cut);
    return `${prefix}${name}${colon}${rest}`;
  });

const locationArb = fc.oneof(
  schemeLike,
  fc.string(),
  fc.webUrl(),
  fc.webPath(),
  fc.string().map((path) => `//${path}`),
);

/** Where a browser goes for a `Location`, resolved against the page. */
function resolved(location: string): URL | undefined {
  try {
    return new URL(location, `${ORIGIN}/a/b`);
  } catch {
    return undefined;
  }
}

describe("redirect()", () => {
  it("throws a Redirect only to locations that resolve to http(s), and a TypeError otherwise", () => {
    fc.assert(
      fc.property(locationArb, (location) => {
        let thrown: unknown;
        try {
          redirect(location);
        } catch (error) {
          thrown = error;
        }
        if (isRedirect(thrown)) {
          expect(thrown.location).toBe(location);
          const url = resolved(location);
          if (url !== undefined) expect(["http:", "https:"]).toContain(url.protocol);
        } else {
          // Refused: the location has another scheme once every control character and space is
          // removed. Stricter than browsers, which keep inner spaces ("j avascript:" is a path):
          // a few odd relative paths are refused, never a script URL let through.
          expect(thrown).toBeInstanceOf(TypeError);
          // oxlint-disable-next-line no-control-regex -- the same characters redirect() strips
          const scheme = /^([a-z][a-z\d+.-]*):/i.exec(location.replace(/[\u0000-\u0020]/g, ""));
          expect(scheme?.[1]).toMatch(/^(?!https?$)/i);
        }
      }),
    );
  });
});

describe("the trailing-slash redirect", () => {
  const segment = fc.oneof(
    fc.constantFrom("", ".", "..", "evil.com", "%2F", "%2e%2e", "\\", "@evil.com", "a b"),
    fc.stringMatching(/^[\w.~-]{1,8}$/),
  );
  const pathArb = fc
    .array(segment, { minLength: 1, maxLength: 6 })
    .map((parts) => `/${parts.join("/")}`);

  it("stays on the site, whatever the path", async () => {
    for (const trailingSlash of ["always", "never"] as const) {
      const { handle } = app(
        { "src/routes/[...path]/page.stsx": page(() => "<h1>any</h1>") },
        { trailingSlash },
      );
      await fc.assert(
        fc.asyncProperty(pathArb, fc.webQueryParameters(), async (path, query) => {
          let request: Request;
          try {
            // Concatenated, as servers build it: `new URL("//evil.com", origin)` would read a host.
            request = new Request(`${ORIGIN}${path}${query === "" ? "" : `?${query}`}`);
          } catch {
            return;
          }
          const response = await handle(request);
          if (response.status !== 308) return;
          const location = response.headers.get("location")!;
          expect(new URL(location, request.url).origin).toBe(ORIGIN);
        }),
        { numRuns: Math.max(20, Math.floor(RUNS / 2)) },
      );
    }
  });
});

describe("the missing-translation redirect (TASK-469)", () => {
  // A root catch-all in the default locale only: `/es/<path>` redirects to `<path>`.
  const { handle } = app(
    { "src/routes/[...path]/page.stsx": page(() => "<h1>any</h1>") },
    {},
    { i18n: resolveI18n({ locales: ["en", "es"], defaultLocale: "en", missing: "redirect" }) },
  );
  const segment = fc.oneof(
    fc.constantFrom("", "\\", "\\\\", "evil.com", "%2F", "%5C", "..", "@evil.com"),
    fc.stringMatching(/^[\w.~-]{1,8}$/),
  );
  const pathArb = fc
    .array(segment, { minLength: 1, maxLength: 6 })
    .map((parts) => `/${parts.join("/")}`);

  /** The redirect's `Location` for `path`, requested as servers build the URL. */
  async function locationOf(path: string, method = "GET"): Promise<string | undefined> {
    let request: Request;
    try {
      request = new Request(`${ORIGIN}${path}`, { method });
    } catch {
      return undefined;
    }
    const response = await handle(request);
    return response.status === 302 || response.status === 307
      ? response.headers.get("location")!
      : undefined;
  }

  it("keeps the redirect on the site for leading slashes and backslashes", async () => {
    for (const path of ["/es//evil.example/x", "/es/\\evil.example", "/es/\\/evil.example"]) {
      for (const method of ["GET", "POST"]) {
        const location = await locationOf(path, method);
        expect(location).toBeDefined();
        expect(new URL(location!, `${ORIGIN}${path}`).origin).toBe(ORIGIN);
      }
    }
    expect(await locationOf("/es//evil.example/x?q=1")).toBe("/evil.example/x?q=1");
  });

  it("stays on the site, whatever the path", async () => {
    await fc.assert(
      fc.asyncProperty(pathArb, fc.webQueryParameters(), async (path, query) => {
        const target = `/es${path}${query === "" ? "" : `?${query}`}`;
        const location = await locationOf(target);
        if (location === undefined) return;
        expect(new URL(location, `${ORIGIN}${target}`).origin).toBe(ORIGIN);
      }),
      { numRuns: Math.max(20, Math.floor(RUNS / 2)) },
    );
  });
});

describe("requestTarget()", () => {
  it("keeps every accepted target on the request's own origin", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.webPath(),
          fc.webUrl(),
          fc.string().map((s) => `//${s}`),
        ),
        fc.constantFrom("GET", "OPTIONS"),
        (url, method) => {
          const target = requestTarget({ url, method } as IncomingMessage);
          if (target === undefined) return;
          expect(target.startsWith("/")).toBe(true);
          let parsed: URL;
          try {
            parsed = new URL(ORIGIN + target);
          } catch {
            return; // refused as a whole by the URL parser (toWebRequest answers 400)
          }
          expect(parsed.origin).toBe(ORIGIN);
        },
      ),
    );
  });
});
