// @vitest-environment happy-dom
// fetchJSON() in the browser: its default abort signal inside async components.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Renderable } from "../contract/client.ts";
import { flush, signal } from "../core/index.ts";
import { $async, $await, $leave, createComponent, render } from "../dom/index.ts";
import { fetchJSON } from "./fetch-json.ts";

const requests: Request[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  requests.length = 0;
});

/** A fetch that records requests and never answers. */
function stubFetch(): void {
  vi.stubGlobal("fetch", (request: Request) => {
    requests.push(request);
    return new Promise<Response>(() => {});
  });
}

describe("fetchJSON() in the browser", () => {
  it("defaults the signal to the run's lifetime inside an async component", () => {
    stubFetch();
    const id = signal(1);
    const User = $async(async function User(props: { id: number }): Promise<Renderable> {
      try {
        const user = (await $await(() => fetchJSON(`https://api.test/users/${props.id}`), 0))();
        return String(user);
      } finally {
        $leave();
      }
    });
    const dispose = render(
      () =>
        createComponent(User, {
          get id() {
            return id();
          },
        }),
      document.createElement("div"),
    );
    expect(requests.map((request) => request.url)).toEqual(["https://api.test/users/1"]);
    expect(requests[0]!.signal.aborted).toBe(false);
    // A newer run supersedes the first one: its fetch is cancelled.
    id.set(2);
    flush();
    expect(requests.map((request) => request.signal.aborted)).toEqual([true, false]);
    dispose();
    expect(requests[1]!.signal.aborted).toBe(true);
  });

  it("leaves the signal alone outside async runs, or when one is passed", () => {
    stubFetch();
    void fetchJSON("https://api.test/a");
    const own = new AbortController();
    const Component = $async(async function Component(): Promise<Renderable> {
      try {
        (await $await(() => fetchJSON("https://api.test/b", { signal: own.signal }), 0))();
        return null;
      } finally {
        $leave();
      }
    });
    const dispose = render(() => createComponent(Component, {}), document.createElement("div"));
    dispose();
    expect(requests.map((request) => request.signal.aborted)).toEqual([false, false]);
    own.abort();
    expect(requests[1]!.signal.aborted).toBe(true);
  });
});
