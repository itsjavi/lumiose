import { describe, expect, it } from "vitest";
import * as client from "./index.ts";
import { createOwner, disposeOwner, runWithOwner } from "./internal.ts";
import * as server from "./server.ts";

describe("server core", () => {
  it("exposes the same names as the client core", () => {
    expect(Object.keys(server).toSorted()).toEqual(Object.keys(client).toSorted());
  });

  it("signals are plain cells", () => {
    const s = server.signal(1);
    s.set(2);
    s.update((n) => n + 1);
    expect(s()).toBe(3);
    expect(s.peek()).toBe(3);
  });

  it("computeds run once", () => {
    const s = server.signal(1);
    let evaluations = 0;
    const c = server.computed(() => {
      evaluations++;
      return s() * 2;
    });
    expect(evaluations).toBe(0);
    expect(c()).toBe(2);
    s.set(5);
    expect(c()).toBe(2);
    expect(evaluations).toBe(1);
  });

  it("effects and onMount never run; store, untrack and batch pass through", () => {
    let runs = 0;
    const dispose = server.effect(() => {
      runs++;
    });
    server.onMount(() => {
      runs++;
    });
    server.flushSync();
    dispose();
    expect(runs).toBe(0);
    const obj = { a: 1 };
    expect(server.store(obj)).toBe(obj);
    expect(server.untrack(() => 1)).toBe(1);
    expect(server.batch(() => 2)).toBe(2);
  });

  it("context and cleanups use owner frames", () => {
    const Ctx = server.createContext("default");
    const root = createOwner(undefined);
    const child = createOwner(root);
    const log: string[] = [];
    runWithOwner(root, () => {
      server.provide(Ctx, "request");
      server.onCleanup(() => log.push("cleanup"));
    });
    expect(runWithOwner(child, () => server.inject(Ctx))).toBe("request");
    disposeOwner(root);
    expect(log).toEqual(["cleanup"]);
  });

  it("lifetime() is the request root's signal", () => {
    const root = createOwner(undefined);
    const nested = createOwner(createOwner(root));
    const fromNested = runWithOwner(nested, server.lifetime);
    expect(runWithOwner(root, server.lifetime)).toBe(fromNested);
    disposeOwner(root);
    expect(fromNested.aborted).toBe(true);
    expect(() => server.lifetime()).toThrow(/server render/);
  });
});
