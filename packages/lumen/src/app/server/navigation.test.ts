// MPA navigation options (TASK-93, decision-24): the View Transitions opt-in and the speculation
// rules the handler adds to page documents.
import { describe, expect, it, vi } from "vitest";
import { insert, ssr } from "../../server/index.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { app as appOf, page } from "./__fixtures__/app.ts";
import { testDefer } from "./__fixtures__/string-renderer.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import { speculationRules, urlPattern } from "./navigation.ts";

type Props = any;

const VIEW_TRANSITIONS =
  "<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>";

/** The rules JSON of a `<script type="speculationrules">`. */
function rulesOf(html: string): unknown {
  const match = /<script type="speculationrules">(.*?)<\/script>/.exec(html);
  return match === null ? undefined : JSON.parse(match[1]!);
}

/** A hand-compiled server component: layouts wrap their children, pages render their file. */
const component = (file: string) =>
  file.includes("_layout")
    ? (props: Props) =>
        ssr(
          ["<div>", "</div>"],
          insert(() => props.children),
        )
    : () => ssr([`<h1>${file}</h1>`]);

/** `{ path: source }` route files (sources only declare `mode`) served by hand-compiled pages. */
function app(files: Record<string, string>, options: Partial<RequestHandlerOptions>) {
  const manifest = createRouteManifest(
    Object.entries(files).map(([path, source]) => ({ path, source })),
  );
  expect(manifest.diagnostics).toEqual([]);
  const { fetch } = createRequestHandler({
    manifest,
    loadModule: async (file) =>
      file.endsWith(".ts")
        ? ({ GET: () => new Response("ok") } as ModuleExports)
        : { default: component(file) },
    spaEntry: "/spa.js",
    onError: vi.fn(),
    ...options,
  });
  return async (path: string) =>
    (await fetch(new Request(new URL(path, "https://lumen.test")))).text();
}

const FILES = {
  "index.tsx": "",
  "_404.tsx": "",
  "about.tsx": 'export const mode = "server";',
  "rss.xml.ts": "",
  "api/[id].ts": 'export const mode = "server";',
  "app/_layout.tsx": 'export const mode = "spa";',
  "app/index.tsx": "",
};

describe("MPA navigation options", () => {
  it("adds nothing by default", async () => {
    const get = app(FILES, {});
    const html = await get("/");
    expect(html).not.toContain("view-transition");
    expect(html).not.toContain("speculationrules");
  });

  it("opts every page document into cross-document View Transitions, without reduced motion", async () => {
    const get = app(FILES, { viewTransitions: true });
    for (const path of ["/", "/about", "/app", "/missing"]) {
      expect(await get(path)).toContain(`${VIEW_TRANSITIONS}</head>`);
    }
    expect(await get("/rss.xml")).toBe("ok");
  });

  it("prefetches the same-origin links of MPA pages on hover, except endpoints", async () => {
    const get = app(FILES, { prefetch: "hover" });
    const rules = {
      prefetch: [
        {
          where: {
            and: [
              { href_matches: "/*" },
              { not: { href_matches: ["/rss.xml{/}?", "/api/:p1{/}?"] } },
            ],
          },
          eagerness: "moderate",
        },
      ],
    };
    expect(rulesOf(await get("/"))).toEqual(rules);
    expect(rulesOf(await get("/about"))).toEqual(rules);
    expect(rulesOf(await get("/missing"))).toEqual(rules);
    // The client router navigates the links of spa pages; <Link prefetch> prefetches there.
    expect(await get("/app")).not.toContain("speculationrules");
  });

  it("prefetches early with viewport, below Vite's base", async () => {
    const get = app({ "index.tsx": "" }, { prefetch: "viewport", base: "/docs/" });
    expect(rulesOf(await get("/docs/"))).toEqual({
      prefetch: [{ where: { href_matches: "/docs{/*}?" }, eagerness: "eager" }],
    });
  });

  it("emits no rules for prefetch: none", () => {
    expect(speculationRules("none", [], "/")).toBe("");
  });
});

const html = async (fetch: (path: string) => Promise<Response>, path: string) =>
  (await fetch(path)).text();

// `<Link prefetch>` on MPA pages (decision-24 amendment): an `<a>` with a `data-l-prefetch` marker.
describe("per-link prefetch", () => {
  const LINKS =
    '<a href="/a" data-l-prefetch="none">a</a><a href="/b" data-l-prefetch="viewport">b</a>';
  const FEED = { GET: () => new Response("<feed/>") };
  const scope = [{ href_matches: "/*" }, { not: { href_matches: ["/feed.xml{/}?"] } }];
  const modules = {
    "src/routes/index.stsx": page(() => LINKS),
    "src/routes/plain.stsx": page(() => '<a href="/a">a</a>'),
    "src/routes/feed.xml.ts": FEED,
  };

  it("groups marked links by level; plain links follow the project default", async () => {
    const { fetch } = appOf(modules, { prefetch: "hover" });
    expect(rulesOf(await html(fetch, "/"))).toEqual({
      prefetch: [
        {
          where: {
            and: [
              ...scope,
              { not: { selector_matches: "[data-l-prefetch]:not([data-l-prefetch=hover])" } },
            ],
          },
          eagerness: "moderate",
        },
        {
          where: { and: [...scope, { selector_matches: "[data-l-prefetch=viewport]" }] },
          eagerness: "eager",
        },
      ],
    });
    // A page without marked links keeps the plain rules.
    expect(rulesOf(await html(fetch, "/plain"))).toEqual({
      prefetch: [{ where: { and: scope }, eagerness: "moderate" }],
    });
  });

  it("prefetches only marked links with prefetch: none, on the pages that have them", async () => {
    const { fetch } = appOf(modules, { prefetch: "none" });
    expect(rulesOf(await html(fetch, "/"))).toEqual({
      prefetch: [
        {
          where: { and: [...scope, { selector_matches: "[data-l-prefetch=hover]" }] },
          eagerness: "moderate",
        },
        {
          where: { and: [...scope, { selector_matches: "[data-l-prefetch=viewport]" }] },
          eagerness: "eager",
        },
      ],
    });
    expect(await html(fetch, "/plain")).not.toContain("speculationrules");
  });

  it("covers the marked links of streamed Suspense boundaries", async () => {
    const streamed = {
      "src/routes/index.stsx": page(() => `<h1>shell</h1>${testDefer(async () => LINKS)}`),
      "src/routes/plain.stsx": page(() => `<h1>shell</h1>${testDefer(async () => "<p>late</p>")}`),
    };
    // A default level: the head gets the marked rules, since a boundary may have marked links.
    const hover = appOf(streamed, { prefetch: "hover" });
    for (const path of ["/", "/plain"]) {
      const doc = await html(hover.fetch, path);
      expect(doc.indexOf('<script type="speculationrules">')).toBeLessThan(doc.indexOf("</head>"));
      expect(JSON.stringify(rulesOf(doc))).toContain("selector_matches");
    }
    // prefetch: "none": the rules follow the stream once a boundary has a marked link.
    const none = appOf(streamed, { prefetch: "none" });
    const marked = await html(none.fetch, "/");
    expect(marked).toMatch(
      /<template for="defer:0">.*<\/template><script type="speculationrules">.*<\/script><\/body><\/html>$/,
    );
    expect(JSON.stringify(rulesOf(marked))).toContain("[data-l-prefetch=viewport]");
    expect(await html(none.fetch, "/plain")).not.toContain("speculationrules");
  });
});

// URLPattern is what browsers match speculation rules' href_matches with.
const matches = (pattern: string, pathname: string) =>
  new URLPattern({ pathname: pattern }).test({ pathname });

describe("urlPattern", () => {
  it("matches a route's URLs as the handler does: with or without a trailing slash", () => {
    const api = urlPattern("", [
      { kind: "static", value: "api" },
      { kind: "param", name: "id" },
    ]);
    expect(api).toBe("/api/:p1{/}?");
    expect(["/api/7", "/api/7/"].map((path) => matches(api, path))).toEqual([true, true]);
    expect(["/api", "/api/7/x"].map((path) => matches(api, path))).toEqual([false, false]);

    const files = urlPattern("/docs", [
      { kind: "static", value: "files" },
      { kind: "rest", name: "path" },
    ]);
    expect(files).toBe("/docs/files{/*}?");
    expect(["/docs/files", "/docs/files/a/b"].map((path) => matches(files, path))).toEqual([
      true,
      true,
    ]);
    expect(matches(files, "/docs/filesx")).toBe(false);
  });

  it("escapes URLPattern syntax in static segments", () => {
    const pattern = urlPattern("", [{ kind: "static", value: "a:b(c)*" }]);
    expect(matches(pattern, "/a:b(c)*")).toBe(true);
    expect(matches(pattern, "/a")).toBe(false);
  });
});
