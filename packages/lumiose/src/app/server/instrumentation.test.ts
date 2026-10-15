// Server instrumentation (decision-49, TASK-298): `register()`, `onRequestError()` and
// `instrumentations` of `src/instrumentation.server.ts`, through the request handler with the
// default renderer.
import { describe, expect, it, vi } from "vitest";
import { $await, $leave, createComponent, ssr, text } from "../../server/index.ts";
import { ErrorBoundary, Suspense } from "../../server/components.ts";
import { createRouteManifest } from "../routes/manifest.ts";
import type { Middleware } from "./context.ts";
import { error, notFound, redirect } from "./control.ts";
import { createRequestHandler, type ModuleExports, type RequestHandlerOptions } from "./handler.ts";
import type { RequestErrorInfo, ServerInstrumentation } from "./instrumentation.ts";

type Modules = Record<string, ModuleExports>;

const ROUTES = "src/routes/";
const FILE = "src/instrumentation.server.ts";
const ORIGIN = { origin: "https://lumiose.test" };

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
    ...(FILE in modules ? { instrumentation: FILE } : {}),
    ...("src/middleware.ts" in modules ? { middleware: "src/middleware.ts" } : {}),
    ...options,
  });
  const fetch = (path: string, init?: RequestInit) =>
    handle(new Request(new URL(path, "https://lumiose.test"), init));
  return { fetch, handle, onError };
}

/** An instrumentation module whose `onRequestError` records `[phase, route, message, digest]`. */
function reporting(extra: ModuleExports = {}) {
  const reports: unknown[][] = [];
  const infos: RequestErrorInfo[] = [];
  const module: ModuleExports = {
    onRequestError(thrown: unknown, info: RequestErrorInfo) {
      infos.push(info);
      reports.push([info.phase, info.route, (thrown as Error).message, info.digest]);
    },
    ...extra,
  };
  return { module, reports, infos };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const page = (html: string): ModuleExports => ({ default: () => ssr([html]) });
const failing = (message: string): ModuleExports => ({
  default: () => {
    throw new Error(message);
  },
});

async function Fails(props: { message: string }) {
  try {
    (await $await(() => sleep(1), 0))();
    throw new Error(props.message);
  } finally {
    $leave();
  }
}

async function Late() {
  try {
    (await $await(() => sleep(1), 0))();
    return ssr(["<p>late</p>"]);
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
      return (caught: Error) => ssr(["<p role=alert>", "</p>"], text(caught.message));
    },
    get children() {
      return children();
    },
  });

/** A page with an ErrorBoundary in the shell and one in a streamed boundary. */
const caughtRoutes = (module: ModuleExports): Modules => ({
  [FILE]: module,
  "src/routes/page.stsx": {
    default: () =>
      ssr(
        ["<main>", "", "</main>"],
        boundary(() => createComponent(Fails, { message: "shell widget" })),
        suspense(() => boundary(() => createComponent(Fails, { message: "streamed widget" }))),
      ),
  },
});

describe("register()", () => {
  it("runs once per module instance, and the first requests wait for it", async () => {
    const log: string[] = [];
    const module: ModuleExports = {
      async register() {
        log.push("register:start");
        await sleep(5);
        log.push("register:end");
      },
    };
    const routes: Modules = {
      [FILE]: module,
      "src/routes/page.stsx": {
        default: () => {
          log.push("page");
          return ssr(["<h1>home</h1>"]);
        },
      },
    };
    const first = app(routes);
    const second = app(routes);
    await Promise.all([first.fetch("/"), first.fetch("/"), second.fetch("/")]);
    expect(log).toEqual(["register:start", "register:end", "page", "page", "page"]);
    // A new module instance (dev, after an edit) registers again.
    await app({ ...routes, [FILE]: { ...module } }).fetch("/");
    expect(log.filter((entry) => entry === "register:start")).toHaveLength(2);
  });

  it("logs what register() throws and serves requests anyway", async () => {
    const { fetch, onError } = app({
      [FILE]: {
        register() {
          throw new Error("no collector");
        },
      },
      "src/routes/page.stsx": page("<h1>home</h1>"),
    });
    expect((await fetch("/")).status).toBe(200);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `${FILE}: register() threw: no collector`,
        cause: new Error("no collector"),
      }),
      expect.any(Request),
    );
  });

  it("logs malformed exports and serves requests without instrumentation", async () => {
    const { fetch, onError } = app({
      [FILE]: { instrumentations: { request: () => undefined } },
      "src/routes/page.stsx": page("<h1>home</h1>"),
    });
    expect((await fetch("/")).status).toBe(200);
    expect(onError.mock.calls[0]![0]).toMatchObject({
      message: expect.stringContaining("export instrumentations must be an array"),
    });
  });

  it("is not loaded while prerendering", async () => {
    const register = vi.fn();
    const { fetch } = app(
      { [FILE]: { register }, "src/routes/page.stsx": page("<h1>home</h1>") },
      { prerendering: true },
    );
    expect((await fetch("/")).status).toBe(200);
    expect(register).not.toHaveBeenCalled();
  });
});

describe("onRequestError()", () => {
  it("receives unexpected errors of each phase with the request, route and params", async () => {
    const { module, reports, infos } = reporting();
    const { fetch, onError } = app({
      [FILE]: module,
      "src/middleware.ts": {
        default: ((ctx, next) => {
          if (ctx.url.searchParams.has("root")) throw new Error("root middleware");
          return next();
        }) satisfies Middleware,
      },
      "src/routes/admin/middleware.ts": {
        default: ((ctx, next) => {
          if (ctx.url.searchParams.has("folder")) throw new Error("folder middleware");
          return next();
        }) satisfies Middleware,
      },
      "src/routes/admin/page.stsx": page("<h1>admin</h1>"),
      "src/routes/books/[id]/page.stsx": {
        default: () => ssr(["<h1>book</h1>"]),
        actions: {
          save: () => {
            throw new Error("action failed");
          },
        },
      },
      "src/routes/api/[id]/route.ts": {
        GET: () => {
          throw new Error("endpoint failed");
        },
      },
      "src/routes/broken/page.stsx": failing("render failed"),
    });
    await fetch("/missing?root");
    await fetch("/admin?folder");
    await fetch("/books/7?/save", { method: "POST", headers: ORIGIN, body: new FormData() });
    await fetch("/books/7?/save", {
      method: "POST",
      headers: { ...ORIGIN, accept: "application/json", "x-lumiose-action": "1" },
      body: new FormData(),
    });
    await fetch("/api/3");
    await fetch("/broken");
    expect(reports).toEqual([
      ["middleware", undefined, "root middleware", undefined],
      ["middleware", "/admin", "folder middleware", undefined],
      ["action", "/books/[id]", "action failed", undefined],
      ["action", "/books/[id]", "action failed", undefined],
      ["endpoint", "/api/[id]", "endpoint failed", undefined],
      ["render", "/broken", "render failed", undefined],
    ]);
    expect(infos[4]!.params).toEqual({ id: "3" });
    expect(infos[4]!.request.url).toBe("https://lumiose.test/api/3");
    // The host's onError still gets each of them.
    expect(onError).toHaveBeenCalledTimes(6);
  });

  it("is not called for redirect(), notFound() and error(status)", async () => {
    const { module, reports } = reporting();
    const { fetch } = app({
      [FILE]: module,
      "src/routes/a/page.stsx": { default: () => redirect("/b") },
      "src/routes/b/page.stsx": { default: () => notFound() },
      "src/routes/c/route.ts": { GET: () => error(403, "no") },
    });
    expect((await fetch("/a")).status).toBe(302);
    expect((await fetch("/b")).status).toBe(404);
    expect((await fetch("/c")).status).toBe(403);
    expect((await fetch("/nowhere")).status).toBe(404);
    expect(reports).toEqual([]);
  });

  it("receives errors an ErrorBoundary caught, with their digest outside dev", async () => {
    const production = reporting();
    const prod = app(caughtRoutes(production.module));
    const body = await (await prod.fetch("/")).text();
    expect(production.reports).toEqual([
      ["render", "/", "shell widget", expect.stringMatching(/^[0-9a-f]{8}$/)],
      ["stream", "/", "streamed widget", expect.stringMatching(/^[0-9a-f]{8}$/)],
    ]);
    for (const [, , , digest] of production.reports) expect(body).toContain(`digest ${digest}`);
    // The server log gets them too, as before (decision-29).
    expect(prod.onError).toHaveBeenCalledTimes(2);

    const development = reporting();
    const dev = app(caughtRoutes(development.module), { dev: true });
    expect(await (await dev.fetch("/")).text()).toContain("<p role=alert>streamed widget</p>");
    expect(development.reports).toEqual([
      ["render", "/", "shell widget", undefined],
      ["stream", "/", "streamed widget", undefined],
    ]);
    // In dev, a caught error is the page's business: no log, no overlay.
    expect(dev.onError).not.toHaveBeenCalled();
  });

  it("receives errors of streamed boundaries no ErrorBoundary handled", async () => {
    const { module, reports } = reporting();
    const { fetch } = app({
      [FILE]: module,
      "src/routes/page.stsx": {
        default: () =>
          ssr(
            ["<h1>shell</h1>", ""],
            suspense(() => createComponent(Fails, { message: "boundary failed" })),
          ),
      },
    });
    const response = await fetch("/");
    expect(response.status).toBe(200);
    await response.text();
    expect(reports).toEqual([["stream", "/", "boundary failed", undefined]]);
  });

  it("receives rejected waitUntil() work, with or without the host's waitUntil", async () => {
    const { module, reports } = reporting();
    const routes: Modules = {
      [FILE]: module,
      "src/routes/job/route.ts": {
        GET: (ctx: { platform: { waitUntil(promise: Promise<unknown>): void } }) => {
          ctx.platform.waitUntil(Promise.reject(new Error("job failed")));
          return new Response("queued");
        },
      },
    };
    const { fetch, onError } = app(routes);
    await fetch("/job");
    await sleep(1);
    expect(reports).toEqual([["waitUntil", "/job", "job failed", undefined]]);
    expect(onError).toHaveBeenCalledTimes(1);

    // A host's waitUntil still gets a promise that rejects; the host logs it, not onError.
    const host = reporting();
    const hosted = app({ ...routes, [FILE]: host.module });
    const waited: Array<Promise<unknown>> = [];
    await hosted.handle(new Request("https://lumiose.test/job"), {
      waitUntil: (promise) => waited.push(promise),
    });
    await expect(waited[0]).rejects.toThrow("job failed");
    expect(host.reports).toEqual([["waitUntil", "/job", "job failed", undefined]]);
    expect(hosted.onError).not.toHaveBeenCalled();
  });

  it("logs what onRequestError throws without changing the response", async () => {
    const { fetch, onError } = app({
      [FILE]: {
        onRequestError() {
          throw new Error("reporter down");
        },
      },
      "src/routes/api/route.ts": {
        GET: () => {
          throw new Error("endpoint failed");
        },
      },
    });
    const response = await fetch("/api");
    expect(response.status).toBe(500);
    expect(onError.mock.calls.map(([logged]) => (logged as Error).message)).toEqual([
      "endpoint failed",
      `${FILE}: onRequestError() threw: reporter down`,
    ]);
  });
});

/** An observer that logs `phase:start info` and `phase:end status` around each phase. */
function tracer(log: string[], name = ""): ServerInstrumentation {
  const span =
    (phase: string, label: (info: any) => string) =>
    async (call: () => Promise<any>, info: any) => {
      log.push(`${name}${phase}:start ${label(info)}`);
      const result = await call();
      const detail = result.status === "error" ? (result.error as Error).message : "";
      const status = result.response === undefined ? "" : ` ${result.response.status}`;
      log.push(`${name}${phase}:end ${result.status}${status}${detail ? ` ${detail}` : ""}`);
    };
  return {
    request: span("request", (info) => `${info.request.method} ${info.route}`),
    middleware: span("middleware", (info) => info.file),
    action: span("action", (info) => `${info.route} ${info.name}`),
    endpoint: span("endpoint", (info) => `${info.method} ${info.route}`),
    render: span("render", (info) => `${info.route} ${JSON.stringify(info.params)}`),
    stream: span("stream", (info) => info.route),
  };
}

describe("instrumentations", () => {
  it("wrap each phase of a request, with the route and the response status", async () => {
    const log: string[] = [];
    const { fetch } = app({
      [FILE]: { instrumentations: [tracer(log)] },
      "src/middleware.ts": { default: ((_ctx, next) => next()) satisfies Middleware },
      "src/routes/books/middleware.ts": { default: ((_ctx, next) => next()) satisfies Middleware },
      "src/routes/books/[id]/page.stsx": {
        default: () =>
          ssr(
            ["<h1>book</h1>", ""],
            suspense(() => createComponent(Late, {})),
          ),
        actions: { save: () => ({ ok: true }) },
      },
      "src/routes/api/route.ts": { POST: () => new Response("created", { status: 201 }) },
      "src/routes/not-found.stsx": page("<h1>missing</h1>"),
    });
    await (await fetch("/books/7")).text();
    expect(log).toEqual([
      "request:start GET /books/[id]",
      "middleware:start src/middleware.ts",
      "middleware:start src/routes/books/middleware.ts",
      'render:start /books/[id] {"id":"7"}',
      "stream:start /books/[id]",
      "render:end success",
      "middleware:end success",
      "middleware:end success",
      "request:end success 200",
      "stream:end success",
    ]);
    log.length = 0;
    await fetch("/books/7?/save", { method: "POST", headers: ORIGIN, body: new FormData() });
    expect(log.slice(0, 5)).toEqual([
      "request:start POST /books/[id]",
      "middleware:start src/middleware.ts",
      "middleware:start src/routes/books/middleware.ts",
      "action:start /books/[id] save",
      "action:end success",
    ]);
    log.length = 0;
    await fetch("/api", { method: "POST" });
    expect(log).toEqual([
      "request:start POST /api",
      "middleware:start src/middleware.ts",
      "endpoint:start POST /api",
      "endpoint:end success",
      "middleware:end success",
      "request:end success 201",
    ]);
    log.length = 0;
    await fetch("/nowhere");
    expect(log).toEqual([
      "request:start GET undefined",
      "middleware:start src/middleware.ts",
      "render:start undefined {}",
      "render:end success",
      "middleware:end success",
      "request:end success 404",
    ]);
  });

  it("see errors as results, and the request goes on as without them", async () => {
    const log: string[] = [];
    const { fetch } = app({
      [FILE]: { instrumentations: [tracer(log)] },
      "src/routes/api/route.ts": {
        GET: () => {
          throw new Error("endpoint failed");
        },
      },
      "src/routes/stream/page.stsx": {
        default: () =>
          ssr(
            ["", ""],
            suspense(() => createComponent(Fails, { message: "boundary failed" })),
          ),
      },
    });
    expect((await fetch("/api")).status).toBe(500);
    expect(log).toEqual([
      "request:start GET /api",
      "endpoint:start GET /api",
      "endpoint:end error endpoint failed",
      "request:end success 500",
    ]);
    log.length = 0;
    await (await fetch("/stream")).text();
    await sleep(1);
    expect(log).toContain("stream:end error boundary failed");
  });

  it("nest in array order, the first outermost", async () => {
    const log: string[] = [];
    const { fetch } = app({
      [FILE]: { instrumentations: [tracer(log, "a."), tracer(log, "b.")] },
      "src/routes/api/route.ts": { GET: () => new Response("ok") },
    });
    await fetch("/api");
    expect(log).toEqual([
      "a.request:start GET /api",
      "b.request:start GET /api",
      "a.endpoint:start GET /api",
      "b.endpoint:start GET /api",
      "b.endpoint:end success",
      "a.endpoint:end success",
      "b.request:end success 200",
      "a.request:end success 200",
    ]);
  });

  it("cannot skip, repeat or break a phase: it runs once, and wrapper errors are logged", async () => {
    const endpoint = vi.fn(() => new Response("ok"));
    const { fetch, onError } = app({
      [FILE]: {
        instrumentations: [
          { endpoint: () => "never calls" },
          {
            endpoint: async (call: () => Promise<unknown>) => {
              await call();
              await call();
            },
          },
          {
            endpoint: () => {
              throw new Error("tracer bug");
            },
          },
        ] satisfies ServerInstrumentation[],
      },
      "src/routes/api/route.ts": { GET: endpoint },
    });
    const response = await fetch("/api");
    expect(await response.text()).toBe("ok");
    expect(endpoint).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: `${FILE}: an instrumentations wrapper threw: tracer bug`,
      }),
      expect.any(Request),
    );
  });

  it("observe in-process requests' phases, but not as requests of their own", async () => {
    const log: string[] = [];
    const { fetch } = app({
      [FILE]: { instrumentations: [tracer(log)] },
      "src/routes/page.stsx": {
        default: async () => {
          const { getRequestScope } = await import("./scope.ts");
          const data = await (
            await getRequestScope()!.fetch!(new Request("https://lumiose.test/api"))
          ).text();
          return ssr(["<p>", "</p>"], text(data));
        },
      },
      "src/routes/api/route.ts": { GET: () => new Response("inner") },
    });
    await (await fetch("/")).text();
    expect(log.filter((entry) => entry.startsWith("request:"))).toEqual([
      "request:start GET /",
      "request:end success 200",
    ]);
    expect(log).toContain("endpoint:start GET /api");
  });
});
