// @vitest-environment happy-dom
// The keyed async cache in the browser (TASK-195, doc-6 §B): deduped component-level awaits,
// stale-while-revalidate, targeted invalidation, aborts, errors, garbage collection and the page
// payload. Components are written in their compiled shape.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Renderable } from "../../contract/client.ts";
import { flush, isPending, signal } from "../../core/index.ts";
import { resetStates } from "../../core/state.ts";
import { Suspense } from "../../dom/boundaries.ts";
import { $async, $await, $leave, createComponent, render } from "../../dom/index.ts";
import { invalidate } from "../actions/client.ts";
import { fetchJSON } from "../fetch-json.ts";
import { GC_TIME, query } from "./client.ts";
import { hashKey, matchKey } from "./shared.ts";

interface Call {
  url: string;
  method: string;
  signal: AbortSignal;
  respond(body: unknown, status?: number): void;
}

let calls: Call[];

/** A fetch whose responses the test sends (`calls[i].respond(body)`). */
function stubFetch(): void {
  vi.stubGlobal("fetch", (request: Request) => {
    return new Promise<Response>((resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(request.signal.reason));
      calls.push({
        url: request.url,
        method: request.method,
        signal: request.signal,
        respond: (body, status = 200) =>
          resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { "content-type": "application/json" },
            }),
          ),
      });
    });
  });
}

const urls = () => calls.map((call) => call.url);

/** Lets responses, awaits and re-runs settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
  }
}

const runs: Record<string, number> = {};

/** An async component that shows what `load` resolves to, counting its resolved runs. */
function view<P>(name: string, load: (props: P) => Promise<unknown>) {
  return $async(async function View(props: P): Promise<Renderable> {
    try {
      const value = (await $await(() => load(props), 0))();
      runs[name] = (runs[name] ?? 0) + 1;
      const node = document.createElement("p");
      node.id = name;
      node.textContent = `${JSON.stringify(value)}${isPending() ? " pending" : ""}`;
      return node;
    } finally {
      $leave();
    }
  });
}

let container: HTMLElement;
let disposers: (() => void)[];

function mount(content: () => Renderable): () => void {
  const dispose = render(content, container);
  disposers.push(dispose);
  return dispose;
}

const text = (id: string) => container.querySelector(`#${id}`)?.textContent;

beforeEach(() => {
  resetStates();
  calls = [];
  for (const key of Object.keys(runs)) delete runs[key];
  container = document.createElement("div");
  document.body.append(container);
  disposers = [];
  stubFetch();
});

afterEach(() => {
  for (const dispose of disposers) dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("keys", () => {
  it("hashes keys stably, ignoring object key order", () => {
    expect(hashKey(["stats", { b: 1, a: [2, { d: 1, c: 0 }] }])).toBe(
      hashKey(["stats", { a: [2, { c: 0, d: 1 }], b: 1 }]),
    );
    expect(hashKey(["a", 1])).not.toBe(hashKey(["a", "1"]));
  });

  it("matches keys by prefix, objects partially (TanStack Query)", () => {
    expect(matchKey(["books", 1], ["books"])).toBe(true);
    expect(matchKey(["books", { page: 1, sort: "t" }], ["books", { page: 1 }])).toBe(true);
    expect(matchKey(["books", { page: 2 }], ["books", { page: 1 }])).toBe(false);
    expect(matchKey(["books"], ["books", 1])).toBe(false);
    expect(matchKey(["stats"], ["books"])).toBe(false);
  });
});

describe("deduplication", () => {
  it("makes one request for components awaiting the same URL, and none for a later one", async () => {
    const Book = view("a", () => fetchJSON("https://api.test/books/1"));
    const Other = view("b", () =>
      fetchJSON(new URL("https://api.test/books/1"), { headers: { "x-test": "1" } }),
    );
    mount(() => [createComponent(Book, {}), createComponent(Other, {})]);
    expect(urls()).toEqual(["https://api.test/books/1"]);
    calls[0]!.respond({ title: "Dune" });
    await settle();
    expect([text("a"), text("b")]).toEqual(['{"title":"Dune"}', '{"title":"Dune"}']);
  });

  it("caches query() results under their key, whatever the object key order", async () => {
    const fn = vi.fn(async () => ({ total: 3 }));
    const A = view("a", () => query(["stats", { b: 1, a: 2 }], fn));
    const B = view("b", () => query(["stats", { a: 2, b: 1 }], fn));
    mount(() => [createComponent(A, {}), createComponent(B, {})]);
    await settle();
    expect(fn).toHaveBeenCalledTimes(1);
    expect([text("a"), text("b")]).toEqual(['{"total":3}', '{"total":3}']);
  });

  it("keeps handler calls and non-GET requests uncached", async () => {
    void fetchJSON("https://api.test/x");
    void fetchJSON("https://api.test/x");
    const fn = vi.fn(async () => 1);
    void query(["outside"], fn);
    void query(["outside"], fn);
    expect(fn).toHaveBeenCalledTimes(2);
    const Post = view("a", () => fetchJSON("https://api.test/x", { method: "POST" }));
    const Again = view("b", () => fetchJSON("https://api.test/x", { method: "post" }));
    mount(() => [createComponent(Post, {}), createComponent(Again, {})]);
    expect(calls.map((call) => call.method)).toEqual(["GET", "GET", "POST", "POST"]);
  });
});

describe("stale-while-revalidate", () => {
  it("shows cached data at once in a new instance, then revalidates it in the background", async () => {
    const Book = view("a", () => fetchJSON("https://api.test/books/1"));
    mount(() => createComponent(Book, {}));
    calls[0]!.respond({ title: "Dune" });
    await settle();
    const Later = view("b", () => fetchJSON("https://api.test/books/1"));
    const fallback = document.createElement("i");
    mount(() =>
      createComponent(Suspense, {
        fallback,
        get children() {
          return createComponent(Later, {});
        },
      }),
    );
    // A few microtasks, no network: the content is in before the browser paints.
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(text("b")).toBe('{"title":"Dune"}');
    expect(fallback.isConnected).toBe(false);
    // The background refetch: new data re-runs both components (re-runs, so `isPending()`).
    expect(urls()).toEqual(["https://api.test/books/1", "https://api.test/books/1"]);
    calls[1]!.respond({ title: "Dune Messiah" });
    await settle();
    expect([text("a"), text("b")]).toEqual([
      '{"title":"Dune Messiah"} pending',
      '{"title":"Dune Messiah"} pending',
    ]);
    expect(runs).toEqual({ a: 2, b: 2 });
    expect(calls).toHaveLength(2);
  });

  it("does not re-run anything when the refetched data did not change", async () => {
    const Book = view("a", () => fetchJSON("https://api.test/books/1"));
    mount(() => createComponent(Book, {}));
    calls[0]!.respond({ title: "Dune", tags: ["sf"] });
    await settle();
    mount(() =>
      createComponent(
        view("b", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    await settle();
    calls[1]!.respond({ title: "Dune", tags: ["sf"] });
    await settle();
    expect(runs).toEqual({ a: 1, b: 1 });
  });
});

describe("invalidate(...targets)", () => {
  it("re-runs only the components that awaited a URL, keeping their UI until the refetch", async () => {
    mount(() => [
      createComponent(
        view("a", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
      createComponent(
        view("b", () => fetchJSON("https://api.test/books/2")),
        {},
      ),
    ]);
    calls[0]!.respond(1);
    calls[1]!.respond(2);
    await settle();
    let done = false;
    const refreshed = invalidate("https://api.test/books/1").then(() => (done = true));
    await settle();
    expect(urls().slice(2)).toEqual(["https://api.test/books/1"]);
    expect(text("a")).toBe("1");
    expect(done).toBe(false);
    calls[2]!.respond(11);
    await refreshed;
    // The re-run resolved while `isPending()` was true; the other component never re-ran.
    expect([text("a"), text("b")]).toEqual(["11 pending", "2"]);
    expect(runs).toEqual({ a: 2, b: 1 });
  });

  it("matches query() keys by prefix", async () => {
    const books = vi.fn(async () => "books");
    const users = vi.fn(async () => "users");
    mount(() => [
      createComponent(
        view("a", () => query(["stats", "books"], books)),
        {},
      ),
      createComponent(
        view("b", () => query(["users"], users)),
        {},
      ),
    ]);
    await settle();
    await invalidate(["stats"]);
    expect([books.mock.calls.length, users.mock.calls.length]).toEqual([2, 1]);
    expect(runs).toEqual({ a: 2, b: 1 });
  });

  it("refetches an invalidated entry no component holds on its next await", async () => {
    const fn = vi.fn(async () => fn.mock.calls.length);
    const dispose = mount(() =>
      createComponent(
        view("a", () => query(["n"], fn)),
        {},
      ),
    );
    await settle();
    dispose();
    await invalidate(["n"]);
    expect(fn).toHaveBeenCalledTimes(1);
    mount(() =>
      createComponent(
        view("b", () => query(["n"], fn)),
        {},
      ),
    );
    await settle();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(text("b")).toBe("2");
  });

  it("warns in development when a string target does not look like a URL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await invalidate("stats", "/api/stats", "https://api.test/x", ["stats"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/invalidate\("stats"\).*invalidate\(\["stats"\]\)/);
    warn.mockRestore();
  });
});

describe("aborts", () => {
  it("lets a superseded run stop waiting without cancelling a request others still await", async () => {
    const id = signal(1);
    mount(() => [
      createComponent(
        view<{ id: number }>("a", (props) => fetchJSON(`https://api.test/books/${props.id}`)),
        {
          get id() {
            return id();
          },
        },
      ),
    ]);
    const disposeB = mount(() =>
      createComponent(
        view("b", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    expect(urls()).toEqual(["https://api.test/books/1"]);
    id.set(2);
    flush();
    expect(urls()).toEqual(["https://api.test/books/1", "https://api.test/books/2"]);
    expect(calls[0]!.signal.aborted).toBe(false);
    // The last waiter leaves: the request is cancelled, and the next await fetches again.
    disposeB();
    expect(calls[0]!.signal.aborted).toBe(true);
    await settle();
    mount(() =>
      createComponent(
        view("c", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    expect(urls()).toHaveLength(3);
  });
});

describe("errors", () => {
  it("never caches a failure: the next await fetches again", async () => {
    const errors: unknown[] = [];
    const { onError } = await import("../../core/owner.ts");
    mount(() => {
      onError((error) => errors.push(error));
      return createComponent(
        view("a", () => fetchJSON("https://api.test/books/1")),
        {},
      );
    });
    calls[0]!.respond({ reason: "down" }, 503);
    await settle();
    expect(errors).toHaveLength(1);
    mount(() =>
      createComponent(
        view("b", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    expect(urls()).toHaveLength(2);
    calls[1]!.respond("ok");
    await settle();
    expect(text("b")).toBe('"ok"');
  });

  it("keeps the data when a background refetch fails", async () => {
    mount(() =>
      createComponent(
        view("a", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    calls[0]!.respond("v1");
    await settle();
    mount(() =>
      createComponent(
        view("b", () => fetchJSON("https://api.test/books/1")),
        {},
      ),
    );
    await settle();
    calls[1]!.respond("down", 500);
    await settle();
    expect([text("a"), text("b")]).toEqual(['"v1"', '"v1"']);
    expect(runs).toEqual({ a: 1, b: 1 });
  });
});

describe("garbage collection and navigation", () => {
  it("keeps entries no component holds for gcTime, then drops them", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => "data");
    const dispose = mount(() =>
      createComponent(
        view("a", () => query(["k"], fn)),
        {},
      ),
    );
    await vi.advanceTimersByTimeAsync(0);
    dispose();
    // Back within gcTime (an SPA navigation back): at once, revalidated in the background.
    await vi.advanceTimersByTimeAsync(GC_TIME - 1000);
    const again = mount(() =>
      createComponent(
        view("b", () => query(["k"], fn)),
        {},
      ),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(text("b")).toBe('"data"');
    again();
    await vi.advanceTimersByTimeAsync(GC_TIME);
    mount(() =>
      createComponent(
        view("c", () => query(["k"], fn)),
        {},
      ),
    );
    expect(fn).toHaveBeenCalledTimes(3);
    expect(text("c")).toBeUndefined();
  });
});

describe("page payload", () => {
  it("starts with the entries the server sent, without fetching them", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<script type="application/json" data-l-payload>${JSON.stringify({
        s: {},
        c: {
          "/api/books/1": { title: "Dune", at: { $: "D", v: "2026-01-01T00:00:00.000Z" } },
          '["stats"]': 3,
        },
      })}</script>`,
    );
    const { frame } = await import("../../dom/frame.ts");
    expect(frame).toBeUndefined();
    const stats = vi.fn(async () => 3);
    mount(() => [
      createComponent(
        view("a", () => fetchJSON("/api/books/1")),
        {},
      ),
      createComponent(
        view("b", () => query(["stats"], stats)),
        {},
      ),
    ]);
    await settle();
    expect([text("a"), text("b")]).toEqual([
      '{"title":"Dune","at":"2026-01-01T00:00:00.000Z"}',
      "3",
    ]);
    // Outside hydration these awaits revalidate in the background, like any cached await;
    // query keys from the payload still match by prefix.
    expect(urls()).toEqual([`${location.origin}/api/books/1`]);
    expect(stats).toHaveBeenCalledTimes(1);
    expect(runs).toEqual({ a: 1, b: 1 });
    // `invalidate()` resolves once nothing is in flight, background refetches included.
    calls[0]!.respond({ title: "Dune", at: "2026-01-01T00:00:00.000Z" });
    await invalidate(["stats"]);
    expect(stats).toHaveBeenCalledTimes(2);
  });
});
