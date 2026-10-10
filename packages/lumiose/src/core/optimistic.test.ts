import { describe, expect, it } from "vitest";
import { effect, flush, optimistic, signal } from "./index.ts";
import { createOwner, disposeOwner, runWithOwner } from "./internal.ts";
import * as server from "./server.ts";

/** A promise settled by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const inc = (n: number) => n + 1;

/** Lets settled promises run their handlers. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("optimistic()", () => {
  it("reads the source when nothing is pending", () => {
    const source = signal(1);
    const likes = optimistic(source);
    expect(likes()).toBe(1);
    source.set(2);
    expect(likes()).toBe(2);
  });

  it("applies an overlay at once and drops it on success, showing the refreshed source", async () => {
    const source = signal(10);
    const likes = optimistic(() => source());
    const { promise, resolve } = deferred();
    likes.update((n) => n + 1, promise);
    expect(likes()).toBe(11);
    // The refresh lands before the promise settles (as submit() does on SPA pages).
    source.set(11);
    expect(likes()).toBe(12);
    resolve();
    await settle();
    expect(likes()).toBe(11);
  });

  it("rolls back on failure, without swallowing the caller's rejection", async () => {
    const likes = optimistic(() => 10);
    const { promise, reject } = deferred();
    likes.set(99, promise);
    expect(likes()).toBe(99);
    reject(new Error("boom"));
    await expect(promise).rejects.toThrow("boom");
    await settle();
    expect(likes()).toBe(10);
  });

  it("applies concurrent overlays in order and drops each when its own promise settles", async () => {
    const likes = optimistic(() => 1);
    const a = deferred();
    const b = deferred();
    const c = deferred();
    likes.update((n) => n + 1, a.promise);
    likes.update((n) => n * 10, b.promise);
    likes.set(5, c.promise);
    likes.update((n) => n + 1, c.promise);
    expect(likes()).toBe(6);
    c.resolve();
    await settle();
    expect(likes()).toBe(20);
    a.reject(new Error("x"));
    await settle();
    expect(likes()).toBe(10);
    b.resolve();
    await settle();
    expect(likes()).toBe(1);
  });

  it("drops one entry when the same function is passed twice", async () => {
    const likes = optimistic(() => 1);
    const a = deferred();
    likes.update(inc, a.promise);
    likes.update(inc, deferred().promise);
    expect(likes()).toBe(3);
    a.resolve();
    await settle();
    expect(likes()).toBe(2);
  });

  it("re-applies pending overlays over the latest source value", () => {
    const source = signal(1);
    const likes = optimistic(source);
    likes.update((n) => n + 1, deferred().promise);
    source.set(100);
    expect(likes()).toBe(101);
  });

  it("notifies effects", async () => {
    const likes = optimistic(() => 0);
    const seen: number[] = [];
    const owner = createOwner(undefined);
    runWithOwner(owner, () => effect(() => void seen.push(likes())));
    flush();
    const { promise, resolve } = deferred();
    likes.update((n) => n + 1, promise);
    flush();
    resolve();
    await settle();
    flush();
    expect(seen).toEqual([0, 1, 0]);
    disposeOwner(owner);
  });

  it("stops writing once its owner is disposed", async () => {
    const owner = createOwner(undefined);
    const likes = runWithOwner(owner, () => optimistic(() => 0));
    const { promise, resolve } = deferred();
    likes.update((n) => n + 1, promise);
    expect(likes()).toBe(1);
    disposeOwner(owner);
    resolve();
    await settle();
    // No write after dispose: the overlay stays as it was, and new overlays are ignored.
    expect(likes()).toBe(1);
    likes.set(7, deferred().promise);
    expect(likes()).toBe(1);
  });

  it("on the server reads the source and ignores writes", () => {
    const likes = server.optimistic(() => 3);
    likes.set(4, deferred().promise);
    likes.update(
      (n) => n + 1,
      Promise.reject(new Error("ignored")).catch(() => {}),
    );
    expect(likes()).toBe(3);
  });
});
