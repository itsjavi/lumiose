// Run subscribers: what `$await` builds on. A run is paused before each await and
// resumed afterwards; reads before and after awaits track into the same node.
import { describe, expect, it } from "vitest";
import { createContext, flush, getAbortSignal, onCleanup, signal, useContext } from "./index.ts";
import {
  createOwner,
  createRun,
  disposeOwner,
  getOwner,
  pauseRun,
  resumeRun,
  runWithOwner,
  type Run,
} from "./internal.ts";
import { activeSub } from "./reactive.ts";
import { SIGNAL_NODE, type Signal } from "./signal.ts";

const hasSubscribers = (s: Signal<unknown>): boolean =>
  (s as never)[SIGNAL_NODE]["subs"] !== undefined;

const mustNotInvalidate = (): void => {
  throw new Error("must not be invalidated");
};

/** A deferred promise, to control when an await resumes. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("runs", () => {
  it("track reads made before and after an await", async () => {
    const before = signal(1);
    const after = signal(10);
    const gate = deferred<number>();
    const invalidations: Run[] = [];
    const run = createRun((r) => invalidations.push(r), undefined);

    resumeRun(run);
    const body = (async () => {
      try {
        const a = before();
        pauseRun(run);
        const fetched = await gate.promise;
        resumeRun(run);
        return a + fetched + after();
      } finally {
        pauseRun(run);
      }
    })();
    pauseRun(run);
    expect(activeSub).toBeUndefined();

    gate.resolve(100);
    expect(await body).toBe(111);
    expect(hasSubscribers(before as Signal<unknown>)).toBe(true);
    expect(hasSubscribers(after as Signal<unknown>)).toBe(true);

    after.set(20);
    expect(invalidations).toEqual([]);
    flush();
    expect(invalidations).toEqual([run]);
    // Superseded: it no longer tracks anything.
    expect(hasSubscribers(before as Signal<unknown>)).toBe(false);
    expect(hasSubscribers(after as Signal<unknown>)).toBe(false);
    before.set(2);
    flush();
    expect(invalidations).toHaveLength(1);
  });

  it("does not track reads made by other code while paused", () => {
    const other = signal(0);
    const run = createRun(mustNotInvalidate, undefined);
    resumeRun(run);
    pauseRun(run);
    other();
    other.set(1);
    flush();
    expect(hasSubscribers(other as Signal<unknown>)).toBe(false);
  });

  it("restores the owner and context on resume, and the previous ones on pause", () => {
    const Ctx = createContext("none");
    const parent = createOwner(undefined);
    runWithOwner(parent, () => Ctx({ value: "parent" }));
    const run = createRun(() => {}, parent);
    const elsewhere = createOwner(undefined);
    runWithOwner(elsewhere, () => {
      resumeRun(run);
      expect(getOwner()).toBe(run);
      expect(useContext(Ctx)).toBe("parent");
      pauseRun(run);
      expect(getOwner()).toBe(elsewhere);
      expect(useContext(Ctx)).toBe("none");
    });
  });

  it("nests: pausing an inner run restores the outer run", () => {
    const outerDep = signal(0);
    const innerDep = signal(0);
    const log: string[] = [];
    const outer = createRun(() => log.push("outer"), undefined);
    const inner = createRun(() => log.push("inner"), outer);
    resumeRun(outer);
    resumeRun(inner);
    innerDep();
    pauseRun(inner);
    expect(activeSub).toBe(outer);
    outerDep();
    pauseRun(outer);
    innerDep.set(1);
    flush();
    expect(log).toEqual(["inner"]);
    outerDep.set(1);
    flush();
    expect(log).toEqual(["inner", "outer"]);
  });

  it("aborts the lifetime on invalidation, but keeps the owner alive until disposed", () => {
    const s = signal(0);
    const log: string[] = [];
    const run = createRun(() => log.push("invalidated"), undefined);
    resumeRun(run);
    s();
    const signalOfRun = getAbortSignal();
    onCleanup(() => log.push("cleanup"));
    pauseRun(run);
    s.set(1);
    flush();
    expect(signalOfRun.aborted).toBe(true);
    expect(log).toEqual(["invalidated"]);
    // A superseded run resumed later does not track, and its lifetime stays aborted.
    resumeRun(run);
    s();
    expect(getAbortSignal().aborted).toBe(true);
    pauseRun(run);
    expect(hasSubscribers(s as Signal<unknown>)).toBe(false);
    disposeOwner(run);
    expect(log).toEqual(["invalidated", "cleanup"]);
  });

  it("each run gets a fresh node; the old one is disposed when the new one takes over", () => {
    const s = signal(0);
    const runs: Run[] = [];
    const parent = createOwner(undefined);
    const start = (): void => {
      const run = createRun(() => {
        start();
      }, parent);
      runs.push(run);
      resumeRun(run);
      s();
      pauseRun(run);
      if (runs.length > 1) disposeOwner(runs[runs.length - 2]!);
    };
    start();
    s.set(1);
    flush();
    s.set(2);
    flush();
    expect(runs).toHaveLength(3);
    expect(runs[0]).not.toBe(runs[1]);
    expect(runs.map((r) => r.state & 1)).toEqual([1, 1, 0]);
  });

  it("a run disposed while paused stops tracking", () => {
    const s = signal(0);
    const run = createRun(mustNotInvalidate, undefined);
    resumeRun(run);
    pauseRun(run);
    disposeOwner(run);
    resumeRun(run);
    s();
    pauseRun(run);
    expect(hasSubscribers(s as Signal<unknown>)).toBe(false);
  });

  it("resume and pause are idempotent", () => {
    const run = createRun(() => {}, undefined);
    resumeRun(run);
    resumeRun(run);
    pauseRun(run);
    expect(activeSub).toBeUndefined();
    expect(getOwner()).toBeUndefined();
    pauseRun(run);
    expect(getOwner()).toBeUndefined();
  });
});
