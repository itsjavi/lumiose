// `response().setStreaming(false)` and `lumiose({ streamTimeout })` through the request handler
// with the default renderer (decision-58, TASK-340).
import { describe, expect, it, vi } from "vitest";
import { $await, $leave, createComponent, ssr, text } from "../../server/index.ts";
import { ErrorBoundary, Suspense } from "../../server/components.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import type { Middleware } from "./context.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import type { RequestErrorInfo } from "./instrumentation.ts";
import { response } from "./scope.ts";
import { DEFAULT_STREAM_TIMEOUT, resolveStreamTimeout } from "./stream-timeout.ts";

type Modules = Record<string, ModuleExports>;

const ROUTES = "src/routes/";
const INSTRUMENTATION = "src/instrumentation.server.ts";

function app(modules: Modules, options: Partial<RequestHandlerOptions> = {}) {
  const manifest = createRouteManifest(
    Object.keys(modules)
      .filter((file) => file.startsWith(ROUTES))
      .map((file) => ({ path: file.slice(ROUTES.length), source: "" })),
    { defaultMode: "server" },
  );
  const onError = vi.fn();
  const { fetch: handle } = createRequestHandler({
    manifest,
    loadModule: async (file) => modules[file] ?? Promise.reject(new Error(`no module ${file}`)),
    onError,
    ...(INSTRUMENTATION in modules ? { instrumentation: INSTRUMENTATION } : {}),
    ...("src/middleware.ts" in modules ? { middleware: "src/middleware.ts" } : {}),
    ...options,
  });
  const fetch = (path: string) => handle(new Request(new URL(path, "https://lumiose.test")));
  return { fetch, onError };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `async function Late({ ms })`: awaits `ms` (forever without it), then renders a paragraph. */
async function Late(props: { ms?: number }) {
  try {
    (await $await(() => (props.ms === undefined ? new Promise(() => {}) : sleep(props.ms)), 0))();
    return ssr(["<p>late</p>"]);
  } finally {
    $leave();
  }
}

/** Turns streaming off after an await: inside a streamed boundary, after the shell. */
async function OffLater() {
  try {
    (await $await(() => sleep(1), 0))();
    response().setStreaming(false);
  } finally {
    $leave();
  }
}

const suspense = (children: () => unknown) =>
  createComponent(Suspense, {
    get fallback() {
      return ssr(["<p>loading</p>"]);
    },
    get children() {
      return children();
    },
  });

const boundary = (children: () => unknown) =>
  createComponent(ErrorBoundary, {
    get fallback() {
      return (caught: Error & { code?: string }) =>
        ssr(["<p role=alert>", "</p>"], text(caught.code ?? caught.message));
    },
    get children() {
      return children();
    },
  });

const late = (ms?: number) => createComponent(Late, ms === undefined ? {} : { ms });

const streamingPage = (children: () => unknown): ModuleExports => ({
  default: () => ssr(["<h1>shell</h1>", ""], suspense(children)),
});

const offMiddleware: Middleware = (_ctx, next) => {
  response().setStreaming(false);
  return next();
};

describe("resolveStreamTimeout()", () => {
  it("takes milliseconds or a duration string, and false", () => {
    expect(resolveStreamTimeout(undefined)).toBe(DEFAULT_STREAM_TIMEOUT);
    expect(DEFAULT_STREAM_TIMEOUT).toBe(30_000);
    expect(resolveStreamTimeout(1500)).toBe(1500);
    expect(resolveStreamTimeout("30s")).toBe(30_000);
    expect(resolveStreamTimeout(" 500ms ")).toBe(500);
    expect(resolveStreamTimeout("2m")).toBe(120_000);
    expect(resolveStreamTimeout("1.5S")).toBe(1500);
    expect(resolveStreamTimeout(false)).toBe(false);
  });

  it("refuses anything else, and durations setTimeout cannot keep", () => {
    for (const bad of [0, -1, Number.NaN, Infinity, 2 ** 31, "30", "1h", "", true, null, {}]) {
      expect(() => resolveStreamTimeout(bad, "lumiose({ streamTimeout })")).toThrow(
        /^lumiose\(\{ streamTimeout \}\): expected a duration/,
      );
    }
  });

  it("is checked when the handler is created", () => {
    expect(() => app({}, { streamTimeout: "soon" })).toThrow(TypeError);
  });
});

describe("response().setStreaming(false)", () => {
  it("in middleware: one fully resolved document, without fallbacks or swap scripts", async () => {
    const { fetch } = app({
      "src/middleware.ts": { default: offMiddleware },
      "src/routes/page.stsx": streamingPage(() => late(5)),
    });
    const html = await (await fetch("/")).text();
    expect(html).toContain("<h1>shell</h1><p>late</p></body>");
    expect(html).not.toContain("<?start");
    expect(html).not.toContain("$swap");
  });

  it("in a page before its first <Suspense>, and in the error page it renders", async () => {
    const { fetch } = app({
      "src/routes/page.stsx": {
        default: () => {
          response().setStreaming(false);
          return ssr(
            ["<h1>shell</h1>", ""],
            suspense(() => late(5)),
          );
        },
      },
      "src/routes/broken/page.stsx": {
        default: () => {
          response().setStreaming(false);
          throw new Error("page failed");
        },
      },
      "src/routes/error.stsx": {
        default: () =>
          ssr(
            ["<h1>error</h1>", ""],
            suspense(() => late(5)),
          ),
      },
    });
    expect(await (await fetch("/")).text()).toContain("<h1>shell</h1><p>late</p></body>");
    const error = await fetch("/broken");
    expect(error.status).toBe(500);
    expect(await error.text()).toContain("<h1>error</h1><p>late</p></body>");
  });

  it("after the shell is sent: LUM5004, and the response streams on", async () => {
    const { fetch, onError } = app({
      "src/routes/page.stsx": streamingPage(() => createComponent(OffLater, {})),
    });
    const html = await (await fetch("/")).text();
    expect(html).toContain('<?start name="lb0">');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "LUM5004" });
    expect(onError.mock.calls[0]![0].message).toContain("Cannot change streaming after the shell");
  });
});

/** An instrumentation module whose `onRequestError` records `[phase, code]`. */
function reporting() {
  const reports: Array<[RequestErrorInfo["phase"], string | undefined]> = [];
  const module: ModuleExports = {
    onRequestError(thrown: unknown, info: RequestErrorInfo) {
      reports.push([info.phase, (thrown as { code?: string }).code]);
    },
  };
  return { module, reports };
}

describe("lumiose({ streamTimeout })", () => {
  it("renders the nearest ErrorBoundary into the stream and reports phase stream", async () => {
    const { module, reports } = reporting();
    const { fetch } = app(
      {
        [INSTRUMENTATION]: module,
        "src/routes/page.stsx": streamingPage(() => boundary(() => late())),
      },
      { streamTimeout: 20, dev: true },
    );
    const html = await (await fetch("/")).text();
    expect(html).toContain('<template for="lb0"><p role=alert>LUM5009</p></template>');
    expect(reports).toEqual([["stream", "LUM5009"]]);
  });

  it("keeps the fallback of a boundary without ErrorBoundary, reports it, and ends the response", async () => {
    const { module, reports } = reporting();
    const { fetch, onError } = app(
      {
        [INSTRUMENTATION]: module,
        "src/routes/page.stsx": streamingPage(() => new Promise(() => {})),
      },
      { streamTimeout: "20ms" },
    );
    const html = await (await fetch("/")).text();
    expect(html).toContain('<?start name="lb0"><p>loading</p><?end></body></html>');
    expect(reports).toEqual([["stream", "LUM5009"]]);
    expect(onError.mock.calls[0]![0]).toMatchObject({ code: "LUM5009" });
  });

  it("applies to fully resolved responses too", async () => {
    const { fetch } = app(
      {
        "src/middleware.ts": { default: offMiddleware },
        "src/routes/page.stsx": streamingPage(() => boundary(() => late())),
      },
      { streamTimeout: 20, dev: true },
    );
    expect(await (await fetch("/")).text()).toContain(
      "<h1>shell</h1><p role=alert>LUM5009</p></body>",
    );
  });

  it("is ignored while prerendering", async () => {
    const { fetch } = app(
      { "src/routes/page.stsx": streamingPage(() => boundary(() => late(30))) },
      { streamTimeout: 1, prerender: true },
    );
    expect(await (await fetch("/")).text()).toContain("<h1>shell</h1><p>late</p></body>");
  });
});
