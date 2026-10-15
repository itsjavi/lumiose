// @vitest-environment happy-dom
// Client instrumentation (decision-49, TASK-299): `onError` and `instrumentations` of
// `src/instrumentation.client.ts`, phase by phase. The build flag is on for this file, as
// `lumiose build` defines it for apps with that file (Vitest reads `import.meta.env` from
// process.env).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../contract/client.ts";
import { effect, flush, signal } from "../core/index.ts";
import { island, renderToString, ssr } from "../server/index.ts";
import type { RouteSegment } from "../app/routes/segments.ts";
import { navigate } from "../app/router/index.ts";
import { createRouter, prepareRoot, resetRouter, type SpaConfig } from "../app/router/router.ts";
import { submit } from "../app/actions/client.ts";
import { fetchJSON } from "../app/fetch-json.ts";
import { query } from "../app/cache/client.ts";
import { ErrorBoundary } from "./boundaries.ts";
import { createComponent, insert, render } from "./index.ts";
import {
  INSTRUMENTED,
  resetClientInstrumentation,
  setClientInstrumentation,
  type ClientErrorInfo,
  type ClientInstrumentation,
} from "./instrument.ts";
import { loadIslands } from "./islands.ts";

vi.hoisted(() => {
  process.env.LUMIOSE_CLIENT_HOOKS = "true";
});

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((done) => setTimeout(done, 0));
};

/** Every wrapper call as `phase info → status`, and every `onError` call. */
let log: string[];
let errors: [unknown, ClientErrorInfo][];

function tracer(): ClientInstrumentation {
  const wrap = (phase: string) => async (call: () => Promise<{ status: string }>, info: object) => {
    const result = await call();
    const { route, ...rest } = info as Record<string, unknown>;
    log.push(`${phase} ${JSON.stringify(rest)} route=${String(route)} → ${result.status}`);
  };
  return {
    navigate: async (call, info) => {
      const result = await call();
      log.push(
        `navigate ${info.type} ${info.from?.url.pathname} → ${info.to?.url.pathname} route=${String(info.route)} ${result.status}`,
      );
    },
    submit: wrap("submit"),
    fetch: wrap("fetch"),
    hydrate: wrap("hydrate"),
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = [];
  errors = [];
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  setClientInstrumentation({
    onError: (error: unknown, info: ClientErrorInfo) => errors.push([error, info]),
    instrumentations: [tracer()],
  });
});
afterEach(() => {
  resetClientInstrumentation();
  consoleError.mockRestore();
  document.body.textContent = "";
  vi.unstubAllGlobals();
});

/** Server HTML of one `client:only` island (rendered afresh by the loader). */
async function serve(ref: string): Promise<void> {
  document.body.innerHTML = await renderToString(() =>
    island(ref, () => ssr(["<p>server</p>"]), {}, "only"),
  );
}

function el(tag: string, text: () => string): HTMLElement {
  const node = document.createElement(tag);
  insert(node, text);
  return node;
}

describe("client instrumentation", () => {
  it("is on in this file (the build flag)", () => {
    expect(INSTRUMENTED).toBe(true);
  });

  it("wraps each island's hydration, and reports a failed one to onError", async () => {
    await serve("/src/case#Ok");
    loadIslands({ "/src/case#Ok": () => Promise.resolve(() => el("p", () => "client")) });
    await settle();
    expect(document.body.textContent).toContain("client");
    const chunk = new TypeError("Failed to fetch dynamically imported module");
    await serve("/src/case#Broken");
    loadIslands({ "/src/case#Broken": () => Promise.reject(chunk) });
    await settle();
    expect(log).toEqual([
      'hydrate {"island":"/src/case#Ok"} route=undefined → success',
      'hydrate {"island":"/src/case#Broken"} route=undefined → error',
    ]);
    expect(errors).toEqual([
      [chunk, { phase: "hydrate", route: undefined, island: "/src/case#Broken" }],
    ]);
  });

  it("reports an island's effect error after hydration, and what an ErrorBoundary caught", async () => {
    const boom = signal(false);
    const failure = new Error("effect boom");
    const Island: Component<object> = () => {
      effect(() => {
        if (boom()) throw failure;
      });
      return el("p", () => "island");
    };
    const caught = new Error("render boom");
    const Bounded: Component<object> = () =>
      createComponent(ErrorBoundary, {
        fallback: (error: unknown) => el("p", () => `fallback ${(error as Error).message}`),
        get children() {
          return createComponent(() => {
            throw caught;
          }, {});
        },
      });
    document.body.innerHTML = await renderToString(() => [
      island("/src/case#Island", () => ssr([""]), {}, "only"),
      island("/src/case#Bounded", () => ssr([""]), {}, "only"),
    ]);
    loadIslands({
      "/src/case#Island": () => Promise.resolve(Island),
      "/src/case#Bounded": () => Promise.resolve(Bounded),
    });
    await settle();
    expect(document.body.textContent).toContain("fallback render boom");
    expect(() => {
      boom.set(true);
      flush();
    }).toThrow(failure);
    expect(errors).toEqual([
      [caught, { phase: "render", route: undefined, island: "/src/case#Bounded" }],
      [failure, { phase: "effect", route: undefined, island: "/src/case#Island" }],
    ]);
  });

  it("wraps SPA navigations with their locations and route, and reports router errors", async () => {
    const s = (value: string): RouteSegment => ({ kind: "static", value });
    const Root: Component<{ children?: Renderable }> = (props) => {
      const main = document.createElement("main");
      insert(main, () => props.children);
      return main;
    };
    const broken = new Error("page boom");
    const modules: Record<string, Component<any>> = {
      "src/routes/layout.tsx": Root,
      "src/routes/page.tsx": () => el("h1", () => "home"),
      "src/routes/about/page.tsx": () => el("h1", () => "about"),
      "src/routes/broken/page.tsx": () => {
        throw broken;
      },
    };
    const APP = "src/routes/layout.tsx";
    const config: SpaConfig = {
      base: "/",
      routes: [
        { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
        { segments: [s("about")], app: APP, levels: [APP, "src/routes/about/page.tsx"] },
        { segments: [s("broken")], app: APP, levels: [APP, "src/routes/broken/page.tsx"] },
      ],
      notFoundPages: [],
      pages: {},
      modules: Object.fromEntries(
        Object.entries(modules).map(([file, component]) => [
          file,
          () => Promise.resolve({ default: component }),
        ]),
      ),
    };
    history.replaceState(null, "", "/");
    createRouter(config, APP);
    const RootComponent = await prepareRoot("src/routes/page.tsx", true);
    const container = document.createElement("div");
    document.body.append(container);
    const dispose = render(() => createComponent(RootComponent, {}), container);
    try {
      await import("../app/router/history.ts");
      await settle();
      await navigate("/about");
      await navigate("/broken");
      await settle();
      expect(log).toEqual([
        "navigate navigate / → /about route=/ success",
        "navigate navigate /about → /broken route=/about success",
      ]);
      expect(errors).toEqual([
        [broken, { phase: "navigate", route: "/broken", island: undefined }],
      ]);
    } finally {
      dispose();
      container.remove();
      resetRouter();
    }
  });

  it("wraps submit() and reports its rejections, not its aborts", async () => {
    const network = new TypeError("Failed to fetch");
    let reply: () => Promise<Response> = () =>
      Promise.resolve(Response.json({ type: "success", status: 200, data: { ok: true } }));
    vi.stubGlobal("fetch", () => reply());
    const result = await submit({ title: "a" }, { action: "/notes?/save", invalidate: false });
    expect(result).toMatchObject({ type: "success" });
    reply = () => Promise.reject(network);
    await expect(submit({ title: "b" }, { action: "/notes?/save" })).rejects.toThrow();
    reply = () => Promise.reject(new DOMException("aborted", "AbortError"));
    await expect(submit({ title: "c" }, { action: "/notes?/save" })).rejects.toThrow();
    await settle();
    const url = `${location.origin}/notes?/save`;
    expect(log).toEqual([
      `submit {"action":"save","url":"${url}"} route=undefined → success`,
      `submit {"action":"save","url":"${url}"} route=undefined → error`,
      `submit {"action":"save","url":"${url}"} route=undefined → error`,
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]![1]).toEqual({ phase: "submit", route: undefined, island: undefined });
  });

  it("wraps fetchJSON requests and query functions", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ id: 1 })));
    await fetchJSON("/api/user/1");
    await query(["user", 1], () => ({ id: 1 }));
    expect(log).toEqual([
      `fetch {"url":"${location.origin}/api/user/1"} route=undefined → success`,
      'fetch {"key":["user",1]} route=undefined → success',
    ]);
  });

  it("keeps the observer rules: a wrapper that throws or never calls changes nothing", async () => {
    const thrown = new Error("wrapper boom");
    setClientInstrumentation({
      onError: () => {
        throw new Error("onError boom");
      },
      instrumentations: [
        {
          fetch: () => {
            throw thrown;
          },
        },
        { fetch: () => undefined },
        { submit: "not a function" },
      ],
    });
    vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ id: 2 })));
    await expect(fetchJSON("/api/user/2")).resolves.toEqual({ id: 2 });
    await serve("/src/case#Broken");
    loadIslands({ "/src/case#Broken": () => Promise.reject(new Error("chunk")) });
    await settle();
    const logged = consoleError.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(logged).toEqual([
      "Lumiose: src/instrumentation.client.ts: instrumentations[].submit must be a function.",
      "Lumiose: an instrumentations wrapper in src/instrumentation.client.ts threw.",
      "Lumiose: hydrate error in island /src/case#Broken",
      "Lumiose: onError() in src/instrumentation.client.ts threw.",
    ]);
  });
});
