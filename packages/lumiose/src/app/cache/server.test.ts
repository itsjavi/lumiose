// The keyed async cache on the server (TASK-195, doc-6 §B): one cache per request, shared by the
// components that await the same entry; entries islands awaited travel once in the page payload.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  $await,
  $leave,
  createComponent,
  island,
  renderToStream,
  ssr,
  text,
} from "../../server/index.ts";
import { getAbortSignal } from "../../core/server.ts";
import { decodeData } from "../../server/serialize.ts";
import { runInRequestScope, type RequestScope } from "../server/scope.ts";
import { fetchJSON } from "../server/fetch-json.ts";
import { query } from "./server.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

let requests: Request[];

/** Answers `https://api.test/<name>` with `{ name, n }`, `n` counting requests to that URL. */
function stubFetch(status = 200): void {
  requests = [];
  vi.stubGlobal("fetch", async (request: Request) => {
    requests.push(request);
    const n = requests.filter((other) => other.url === request.url).length;
    return Response.json({ name: new URL(request.url).pathname.slice(1), n }, { status });
  });
}

/** An async server component rendering what `load` resolves to. */
async function Show(props: { load: () => Promise<unknown> }) {
  try {
    const value = (await $await(() => props.load(), 0))();
    return ssr(["<p>", "</p>"], text(JSON.stringify(value)));
  } finally {
    $leave();
  }
}

const show = (load: () => Promise<unknown>) => createComponent(Show, { load });

/** Awaits the same failing URL twice. */
async function Twice() {
  try {
    let first: unknown;
    let second: unknown;
    try {
      first = (await $await(() => fetchJSON("https://api.test/flaky"), 0))();
    } catch {
      first = "failed";
    }
    try {
      second = (await $await(() => fetchJSON("https://api.test/flaky"), 1))();
    } catch {
      second = "failed again";
    }
    return ssr(["<p>", " ", "</p>"], text(String(first)), text(String(second)));
  } finally {
    $leave();
  }
}

const wrapped = () => query(["wrapped"], () => fetchJSON("https://api.test/inner"));
const Card = () => show(() => fetchJSON("/api/books/1"));
const Derived = () =>
  show(() => fetchJSON("https://api.test/a").then((data) => (data as { n: number }).n));

class Book {
  readonly id = 1;
}
const BookCard = () => show(() => query(["book"], async () => new Book()));

const request = () =>
  ({ ctx: { url: new URL("https://app.test/page"), locals: {} } }) as unknown as RequestScope;

/** The decoded `c` records of the page payloads in some HTML. */
function cachePayloads(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/json" data-l-payload>(.*?)<\/script>/g)]
    .map((match) => (JSON.parse(match[1]!) as { c?: Record<string, unknown> }).c)
    .filter((c) => c !== undefined)
    .map((c) =>
      Object.fromEntries(Object.entries(c).map(([key, data]) => [key, decodeData(data)])),
    );
}

function islandRecords(html: string): { awaits?: Record<string, unknown> }[] {
  return [
    ...html.matchAll(/<script type="application\/json" data-l-islands>(.*?)<\/script>/g),
  ].flatMap((match) => JSON.parse(match[1]!) as { awaits?: Record<string, unknown> }[]);
}

describe("server cache", () => {
  it("makes one request per URL and one call per key for the components of a request", async () => {
    stubFetch();
    const stats = vi.fn(async () => ({ total: 3 }));
    const html = (
      await renderToStream(() => [
        show(() => fetchJSON("https://api.test/books")),
        show(() => fetchJSON("https://api.test/books")),
        show(() => query(["stats", { a: 1, b: 2 }], stats)),
        show(() => query(["stats", { b: 2, a: 1 }], stats)),
      ])
    ).body;
    expect(requests).toHaveLength(1);
    expect(stats).toHaveBeenCalledTimes(1);
    expect(html).toBe(
      '<p>{"name":"books","n":1}</p><p>{"name":"books","n":1}</p><p>{"total":3}</p><p>{"total":3}</p>',
    );
    // Another render (another request) has a cache of its own.
    await renderToStream(() => show(() => fetchJSON("https://api.test/books")));
    expect(requests).toHaveLength(2);
  });

  it("keeps handler calls, non-GET requests and query() outside components uncached", async () => {
    stubFetch();
    await runInRequestScope(request(), async () => {
      await fetchJSON("/api/x");
      await fetchJSON("/api/x");
      const fn = vi.fn(async () => 1);
      await query(["k"], fn);
      await query(["k"], fn);
      expect(fn).toHaveBeenCalledTimes(2);
    });
    await renderToStream(() => [
      show(() => fetchJSON("https://api.test/y", { method: "POST" })),
      show(() => fetchJSON("https://api.test/y", { method: "POST" })),
    ]);
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      "GET https://app.test/api/x",
      "GET https://app.test/api/x",
      "POST https://api.test/y",
      "POST https://api.test/y",
    ]);
  });

  it("never caches a failure: the next await fetches again", async () => {
    stubFetch(503);
    expect((await renderToStream(() => createComponent(Twice, {}))).body).toBe(
      "<p>failed failed again</p>",
    );
    expect(requests).toHaveLength(2);
  });

  it("runs query() functions outside the component: their fetchJSON calls are plain requests", async () => {
    stubFetch();
    await renderToStream(() =>
      island(
        "/src/A.stsx#A",
        () => [show(wrapped), show(() => fetchJSON("https://api.test/inner"))],
        {},
        "load",
      ),
    ).then(({ body }) => {
      // Two entries: the query's and the direct fetchJSON's (the inner call did not create one).
      expect(Object.keys(cachePayloads(body)[0]!)).toEqual([
        '["wrapped"]',
        "https://api.test/inner",
      ]);
    });
    expect(requests).toHaveLength(2);
  });
});

describe("query() function context and cache: no-store", () => {
  it("passes { signal, queryKey } to the query function: the shared request's signal", async () => {
    const contexts: { signal: AbortSignal; queryKey: unknown; own: AbortSignal }[] = [];
    const fn = vi.fn(async (context: { signal: AbortSignal; queryKey: readonly unknown[] }) => {
      contexts.push({ ...context, own: getAbortSignal() });
      return context.queryKey.length;
    });
    await renderToStream(() => [
      show(() => query(["books", { page: 2 }], fn)),
      show(() => query(["books", { page: 2 }], fn)),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(contexts[0]!.queryKey).toEqual(["books", { page: 2 }]);
    expect(contexts[0]!.signal).toBeInstanceOf(AbortSignal);
    expect(contexts[0]!.signal).toBe(contexts[0]!.own);
    // Outside a component (a handler), a signal is still passed.
    await runInRequestScope(request(), () =>
      query(["handler"], (context) => {
        expect(context.signal).toBeInstanceOf(AbortSignal);
        expect(context.queryKey).toEqual(["handler"]);
      }),
    );
  });

  it("makes a GET with cache: no-store a plain request: not deduped, not in the payload", async () => {
    stubFetch();
    const fresh = () => fetchJSON("https://api.test/live", { cache: "no-store" });
    const html = (
      await renderToStream(() =>
        island("/src/A.stsx#A", () => [show(fresh), show(fresh)], {}, "load"),
      )
    ).body;
    expect(requests).toHaveLength(2);
    expect(requests.every((r) => r.cache === "no-store")).toBe(true);
    expect(cachePayloads(html)).toEqual([]);
    // The island replays the awaited values from its own await records instead.
    expect(islandRecords(html)[0]!.awaits).toEqual({
      "0.0:0:0": { name: "live", n: 1 },
      "0.1:0:0": { name: "live", n: 2 },
    });
  });
});

describe("server cache and the page payload", () => {
  it("sends the entries islands awaited once, with markers in their await records", async () => {
    stubFetch();
    const shell = await runInRequestScope(request(), () =>
      renderToStream(() => [
        island("/src/Card.stsx#Card", Card, {}, "load"),
        island("/src/Card.stsx#Card", Card, {}, "load"),
        // Server-only: never sent.
        show(() => fetchJSON("/api/secret")),
        show(() => query(["server-only"], async () => "hidden")),
      ]),
    );
    expect(cachePayloads(shell.body)).toEqual([{ "/api/books/1": { name: "api/books/1", n: 1 } }]);
    expect(islandRecords(shell.body).map((record) => record.awaits)).toEqual([
      { "c:0.0:0:0": 1 },
      { "c:0.0:0:0": 1 },
    ]);
    expect(requests.map((r) => r.url)).toEqual([
      "https://app.test/api/books/1",
      "https://app.test/api/secret",
    ]);
  });

  it("still records awaits of values derived from cached ones", async () => {
    stubFetch();
    const shell = await renderToStream(() => island("/src/Card.stsx#Card", Derived, {}, "load"));
    expect(islandRecords(shell.body)[0]!.awaits).toEqual({ "0.0:0:0": 1 });
    expect(cachePayloads(shell.body)).toEqual([{ "https://api.test/a": { name: "a", n: 1 } }]);
  });

  it("rejects cached values islands awaited that are not plain data with LUM4007", async () => {
    const failing = renderToStream(() => island("/src/Card.stsx#Card", BookCard, {}, "load"));
    await expect(failing).rejects.toMatchObject({ code: "LUM4007" });
    await expect(failing).rejects.toThrow(/cached under \["book"\] is an instance of Book/);
  });
});
