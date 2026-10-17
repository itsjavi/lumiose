// `lumiose({ csp: "strict" })` (TASK-138): the fetch handler with the default renderer and
// hand-compiled server components, per request (nonces) and while prerendering (hashes).
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  $await,
  $leave,
  createComponent,
  nonceAttr,
  ssr,
  styleAttr,
  text,
} from "../../server/index.ts";
import { Suspense } from "../../server/components.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { addNonce, hashPolicy, withHashPolicy } from "./csp.ts";
import type { Middleware } from "./context.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import { cspNonce } from "./scope.ts";
import { STYLESHEETS_LOADED } from "./stylesheets.ts";

type Modules = Record<string, ModuleExports>;

function app(modules: Modules, options: Partial<RequestHandlerOptions> = {}) {
  const manifest = createRouteManifest(
    Object.keys(modules)
      .filter((file) => file.startsWith("src/routes/"))
      .map((file) => ({ path: file.slice("src/routes/".length), source: "" })),
  );
  const { fetch } = createRequestHandler({
    manifest,
    loadModule: async (file) => modules[file] ?? Promise.reject(new Error(`no module ${file}`)),
    onError: vi.fn(),
    csp: "strict",
    viewTransitions: true,
    prefetch: "hover",
    headAssets: () =>
      '<style data-l-css="/a.css">.a{}</style><link rel="stylesheet" href="/b.css">' +
      STYLESHEETS_LOADED,
    ...options,
  });
  return (path: string) => fetch(new Request(new URL(path, "https://lumiose.test")));
}

async function Late() {
  try {
    (await $await(() => new Promise((resolve) => setTimeout(resolve, 1)), 0))();
    return ssr(["<p>late</p>"]);
  } finally {
    $leave();
  }
}

const page: ModuleExports = {
  mode: "server",
  default: () =>
    ssr(
      ["<main", "><i>", "</i>", "</main>"],
      styleAttr({ color: "red" }),
      text(cspNonce() ?? "none"),
      createComponent(Suspense, {
        get fallback() {
          return ssr(["<p>loading</p>"]);
        },
        get children() {
          return createComponent(Late, {});
        },
      }),
    ),
};

const ownPolicy: Middleware = async (_ctx, next) => {
  const res = await next();
  res.headers.set("content-security-policy", "default-src 'self'");
  return res;
};

const sha = (source: string) => `'sha256-${createHash("sha256").update(source).digest("base64")}'`;

describe('lumiose({ csp: "strict" })', () => {
  it("puts the nonce on src/instrumentation.client.ts and its preloads (decision-49)", async () => {
    const fetch = app(
      { "src/routes/page.stsx": page },
      { clientEntry: { url: "/assets/client.js", preloads: ["/assets/sdk.js"] } },
    );
    const res = await fetch("/");
    const nonce = /'nonce-([^']+)'/.exec(res.headers.get("content-security-policy")!)![1]!;
    const html = await res.text();
    expect(html).toContain(
      `<link nonce="${nonce}" rel="modulepreload" href="/assets/sdk.js"><script nonce="${nonce}" type="module" src="/assets/client.js" data-l-client></script>`,
    );
  });

  it("puts a fresh nonce on every inline script and style and in the policy header", async () => {
    const fetch = app({ "src/routes/page.stsx": page });
    const res = await fetch("/");
    const policy = res.headers.get("content-security-policy")!;
    const nonce = /'nonce-([^']+)'/.exec(policy)![1]!;
    expect(policy).toBe(
      `script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`,
    );
    const html = await res.text();
    expect(html).toContain(`<meta property="csp-nonce" nonce="${nonce}">`);
    // The page reads it with cspNonce().
    expect(html).toContain(`<i>${nonce}</i>`);
    // `style` props become rules; no inline style attribute is left.
    expect(html).toContain('<main data-l-v="0">');
    expect(html).toContain(`<style nonce="${nonce}">[data-l-v="0"]{color:red}</style>`);
    expect(html).not.toMatch(/\sstyle="/);
    const tags = [...html.matchAll(/<(script|style)\b[^>]*>/g)].map((match) => match[0]);
    expect(tags.length).toBeGreaterThan(4);
    for (const tag of tags) {
      if (!tag.includes('type="application/json"')) expect(tag).toContain(`nonce="${nonce}"`);
    }
    expect(html).toContain(
      `<link rel="stylesheet" href="/b.css"><script nonce="${nonce}">${STYLESHEETS_LOADED.slice(8)}`,
    );
    // Another response, another nonce.
    const again = (await fetch("/")).headers.get("content-security-policy")!;
    expect(again).not.toContain(nonce);
  });

  it("gives JSX-authored scripts and styles the nonce; an explicit one wins (TASK-142)", async () => {
    // As compiled with `strictCsp`: `<script innerHTML>`, an SVG `<style>`, a static `style`
    // string and a script with its own `nonce`.
    const authored: ModuleExports = {
      mode: "server",
      default: () =>
        ssr(
          [
            "<main",
            "><script",
            ">window.a = 1</script><svg><style",
            ">rect{fill:teal}</style></svg><script nonce=own>window.b = 2</script></main>",
          ],
          styleAttr("color: red"),
          nonceAttr(),
          nonceAttr(),
        ),
    };
    const res = await app({ "src/routes/page.stsx": authored })("/");
    const nonce = /'nonce-([^']+)'/.exec(res.headers.get("content-security-policy")!)![1]!;
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}">window.a = 1</script>`);
    expect(html).toContain(`<style nonce="${nonce}">rect{fill:teal}</style>`);
    expect(html).toContain("<script nonce=own>window.b = 2</script>");
    expect(html).not.toMatch(/\sstyle="/);
    // Prerendered, the same page gets no nonce: its hash policy lists the inline elements.
    const prerendered = await (
      await app({ "src/routes/page.stsx": authored }, { prerendering: true })("/")
    ).text();
    expect(prerendered).toContain("<script>window.a = 1</script>");
    expect(prerendered).toContain(sha("window.a = 1"));
    expect(prerendered).toContain(sha("rect{fill:teal}"));
  });

  it("keeps nonce'd pages out of shared caches unless the page sets Cache-Control (TASK-165)", async () => {
    const fetch = app({
      "src/routes/page.stsx": page,
      "src/routes/cached/page.stsx": {
        ...page,
        headers: () => ({ "cache-control": "public, max-age=60" }),
      },
    });
    expect((await fetch("/")).headers.get("cache-control")).toBe("private, no-store");
    expect((await fetch("/cached")).headers.get("cache-control")).toBe("public, max-age=60");
  });

  it("leaves the policy to a page or middleware that sets one", async () => {
    const fetch = app(
      { "src/routes/page.stsx": page, "src/middleware.ts": { default: ownPolicy } },
      { middleware: "src/middleware.ts" },
    );
    expect((await fetch("/")).headers.get("content-security-policy")).toBe("default-src 'self'");
  });

  it("leaves a path whose lumiose({ headers }) sets a policy to it", async () => {
    const headers = [
      { path: "/admin/**", headers: { "content-security-policy": "default-src 'self'" } },
    ];
    const fetch = app(
      { "src/routes/page.stsx": page, "src/routes/admin/page.stsx": page },
      { headers },
    );
    // The adapter sends the configured header; the handler adds none of its own there.
    expect((await fetch("/admin")).headers.get("content-security-policy")).toBeNull();
    expect((await fetch("/")).headers.get("content-security-policy")).toMatch(
      /^script-src 'nonce-/,
    );
    const prerender = app({ "src/routes/admin/page.stsx": page }, { headers, prerendering: true });
    expect(await (await prerender("/admin")).text()).not.toContain("http-equiv");
  });

  it("sends no header in dev, where Vite injects its own styles", async () => {
    const fetch = app({ "src/routes/page.stsx": page }, { dev: true });
    const res = await fetch("/");
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(await res.text()).toMatch(/<style nonce="[^"]+">\[data-l-v/);
  });

  it("allows a prerendered page's inline scripts and styles by hash", async () => {
    const fetch = app({ "src/routes/page.stsx": page }, { prerendering: true });
    const res = await fetch("/");
    expect(res.headers.get("content-security-policy")).toBeNull();
    const html = await res.text();
    expect(html).not.toContain("nonce");
    expect(html).toContain("<i>none</i>");
    const meta =
      /<head>(?:<meta charset="utf-8">)?<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(
        html,
      );
    expect(meta).not.toBeNull();
    expect(meta![1]).toContain(sha('[data-l-v="0"]{color:red}'));
    expect(meta![1]).toContain(sha(".a{}"));
    // The script after the linked stylesheets (TASK-278).
    expect(meta![1]).toContain(sha(/<script>(.*)<\/script>/.exec(STYLESHEETS_LOADED)![1]!));
    expect(meta![1]).toMatch(/^script-src 'self' 'sha256-[^;]+; style-src 'self' /);
  });
});

describe("csp helpers", () => {
  it("adds a nonce to scripts, styles and module preloads only", () => {
    expect(
      addNonce(
        '<script type="module" src="/l.js"></script><link rel="modulepreload" href="/m.js"><link rel="stylesheet" href="/s.css"><style nonce="x">a{}</style>',
        "n",
      ),
    ).toBe(
      '<script nonce="n" type="module" src="/l.js"></script><link nonce="n" rel="modulepreload" href="/m.js"><link rel="stylesheet" href="/s.css"><style nonce="x">a{}</style>',
    );
    expect(addNonce("<style>a{}</style>", undefined)).toBe("<style>a{}</style>");
  });

  it("hashes executable inline scripts and styles, not data blocks or external scripts", async () => {
    const policy = await hashPolicy(
      '<script nonce="m" type="application/json">{}</script><script nonce="m" src="/x.js"></script><script nonce="m" type="speculationrules">{}</script><style nonce="m">a{}</style>',
      "m",
    );
    const directives = policy.split("; ");
    expect(directives[0]!.split(" ")).toHaveLength(3);
    expect(directives[1]!.split(" ")).toHaveLength(3);
    expect(await withHashPolicy('<p nonce="m">no head</p>', "m")).toBe("<p>no head</p>");
  });

  it("hashes only what carries the marker: injected markup stays blocked (TASK-165)", async () => {
    const html = await withHashPolicy(
      '<html><head><script nonce="m">ok()</script></head><body><div><script>evil()</script><style>x{}</style></div></body></html>',
      "m",
    );
    expect(html).not.toContain("nonce=");
    const policy = /content="([^"]+)"/.exec(html)![1]!;
    expect(policy).toContain(sha("ok()"));
    expect(policy).not.toContain(sha("evil()"));
    expect(policy).not.toContain(sha("x{}"));
  });
});
