// End-to-end: the fetch handler with the default renderer (lumen/server's renderToStream) and
// hand-compiled server components (contract doc-2 §5), inside the default and custom documents.
import { describe, expect, it, vi } from "vitest";
import { createContext, inject, provide } from "../../core/server.ts";
import { $await, $leave, createComponent, insert, island, ssr, text } from "../../server/index.ts";
import { ErrorBoundary, Meta, Suspense, Title } from "../../server/components.ts";
import { SWAP_SCRIPT } from "../../server/render.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import { notFound, redirect } from "./control.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import { response, url } from "./scope.ts";

type Props = any;
type Modules = Record<string, ModuleExports>;

const ROUTES = "src/routes/";
const DOCUMENT_START =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

function app(modules: Modules, options: Partial<RequestHandlerOptions> = {}) {
  const manifest = createRouteManifest(
    Object.keys(modules)
      .filter((file) => file.startsWith(ROUTES))
      .map((file) => ({ path: file.slice(ROUTES.length), source: "" })),
  );
  const onError = vi.fn();
  const { fetch: handle } = createRequestHandler({
    manifest,
    loadModule: async (file) => modules[file] ?? Promise.reject(new Error(`no module ${file}`)),
    onError,
    ...options,
  });
  const fetch = (path: string) => handle(new Request(new URL(path, "https://lumen.test")));
  return { fetch, onError };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `async function Late({ ms, text })`: awaits, then renders a paragraph. */
async function Late(props: Props) {
  try {
    (await $await(() => sleep(props.ms ?? 1), 0))();
    return ssr(["<p>", "</p>"], text(props.text));
  } finally {
    $leave();
  }
}

function suspense(children: () => unknown) {
  return createComponent(Suspense, {
    get fallback() {
      return ssr(["<p>loading</p>"]);
    },
    get children() {
      return children();
    },
  });
}

function title(value: string) {
  return createComponent(Title, {
    get children() {
      return value;
    },
  });
}

function Layout(props: Props) {
  return ssr(["", "<div id=app>", "</div>"], title("Site"), insert(props.children));
}

async function RedirectLater() {
  try {
    (await $await(() => sleep(1), 0))();
    redirect("/login");
  } finally {
    $leave();
  }
}

async function TitleLater() {
  try {
    (await $await(() => sleep(1), 0))();
    return title("Too late");
  } finally {
    $leave();
  }
}

async function StatusLater() {
  try {
    (await $await(() => sleep(1), 0))();
    response().setStatus(500);
  } finally {
    $leave();
  }
}

async function Fails() {
  try {
    (await $await(() => sleep(1), 0))();
    throw new Error("widget failed");
  } finally {
    $leave();
  }
}

const Theme = createContext("light");

function CustomDocument(props: Props) {
  provide(Theme, "dark");
  return ssr(
    ['<html lang="es"><head>', "", "", '</head><body class="', '">', "</body></html>"],
    createComponent(Meta, { name: "theme-color", content: "#000" }),
    title("Docs"),
    insert(props.head),
    text(inject(Theme)),
    insert(props.body),
  );
}

async function ThemedPage() {
  try {
    (await $await(() => sleep(1), 0))();
    return ssr(["", "<h1>", "</h1>"], title("Themed"), text(inject(Theme)));
  } finally {
    $leave();
  }
}

function Counter(props: Props) {
  return ssr(["<button>", "</button>"], insert(props.start));
}

describe("default server renderer", () => {
  it("streams Suspense boundaries inside the default document, after the head", async () => {
    const { fetch } = app({
      "src/routes/_layout.stsx": { default: Layout },
      "src/routes/index.stsx": {
        default: () =>
          ssr(
            ["", "<h1>Home</h1>", ""],
            createComponent(Meta, { name: "description", content: "Home page" }),
            suspense(() => createComponent(Late, { text: `late ${url().pathname}` })),
          ),
      },
    });
    const res = await fetch("/");
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(await res.text()).toBe(
      `${DOCUMENT_START}<title>Site</title><meta name="description" content="Home page"></head><body>` +
        '<div id=app><h1>Home</h1><?start name="lb0"><p>loading</p><?end></div>' +
        `<script>${SWAP_SCRIPT}</script><template for="lb0"><p>late /</p></template><script>$swap("lb0")</script>` +
        "</body></html>",
    );
  });

  it("renders the custom document through createComponent: context, head defaults, page title wins", async () => {
    const { fetch } = app(
      {
        "src/document.stsx": { default: CustomDocument },
        "src/routes/index.stsx": { default: ThemedPage },
      },
      { document: "src/document.stsx", headAssets: () => '<link rel="stylesheet" href="/a.css">' },
    );
    expect(await (await fetch("/")).text()).toBe(
      '<!doctype html><html lang="es"><head><title>Themed</title><meta name="theme-color" content="#000">' +
        '<link rel="stylesheet" href="/a.css"></head><body class="dark"><h1>dark</h1></body></html>',
    );
  });

  it("streams inside the custom document's body", async () => {
    const { fetch } = app(
      {
        "src/document.stsx": { default: CustomDocument },
        "src/routes/index.stsx": {
          default: () => suspense(() => createComponent(Late, { text: "x" })),
        },
      },
      { document: "src/document.stsx" },
    );
    const html = await (await fetch("/")).text();
    expect(html).toMatch(/<body class="dark"><\?start name="lb0"><p>loading<\/p><\?end><script>/);
    expect(
      html.endsWith(
        '<template for="lb0"><p>x</p></template><script>$swap("lb0")</script></body></html>',
      ),
    ).toBe(true);
  });

  it("renders an ErrorBoundary fallback inside a streamed boundary", async () => {
    const { fetch, onError } = app({
      "src/routes/index.stsx": {
        default: () =>
          suspense(() =>
            createComponent(ErrorBoundary, {
              get fallback() {
                return (error: Error) => ssr(["<p role=alert>", "</p>"], text(error.message));
              },
              get children() {
                return createComponent(Fails, {});
              },
            }),
          ),
      },
    });
    expect(await (await fetch("/")).text()).toContain(
      '<template for="lb0"><p role=alert>widget failed</p></template>',
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports LUM5004 for redirects, head and status changes inside a streamed boundary", async () => {
    for (const Component of [RedirectLater, TitleLater, StatusLater]) {
      const { fetch, onError } = app({
        "src/routes/index.stsx": {
          default: () =>
            ssr(
              ["<h1>shell</h1>", ""],
              suspense(() => createComponent(Component, {})),
            ),
        },
      });
      const res = await fetch("/");
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(
        `${DOCUMENT_START}</head><body><h1>shell</h1><?start name="lb0"><p>loading</p><?end></body></html>`,
      );
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0]![0]).toMatchObject({ code: "LUM5004" });
    }
  });

  it("turns redirect() and notFound() in the shell into responses", async () => {
    const { fetch } = app({
      "src/routes/_404.stsx": {
        default: (props: Props) => ssr(["<h1>", "</h1>"], text(props.status)),
      },
      "src/routes/private.stsx": { default: RedirectLater },
      "src/routes/missing.stsx": {
        default: async () => {
          try {
            (await $await(() => sleep(1), 0))();
            notFound();
          } finally {
            $leave();
          }
        },
      },
    });
    const redirected = await fetch("/private");
    expect(redirected.status).toBe(302);
    expect(redirected.headers.get("location")).toBe("/login");
    const missing = await fetch("/missing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe(`${DOCUMENT_START}</head><body><h1>404</h1></body></html>`);
  });

  it("renders fully resolved when prerendering, with island records and preload hints", async () => {
    const { fetch } = app(
      {
        "src/routes/index.stsx": {
          default: () =>
            ssr(
              ["", ""],
              suspense(() => island("/src/Counter.stsx#Counter", Counter, { start: 3 }, "load")),
            ),
        },
      },
      { prerender: true },
    );
    expect(await (await fetch("/")).text()).toBe(
      `${DOCUMENT_START}<link rel="modulepreload" href="/src/Counter.stsx"></head><body>` +
        "<!--l:0--><button><!--[-->3<!--]--></button><!--/l:0-->" +
        '<script type="application/json" data-l-islands>[{"id":0,"ref":"/src/Counter.stsx#Counter","strategy":"load","props":{"start":3}}]</script>' +
        "</body></html>",
    );
  });
});
