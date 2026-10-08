import { describe, expect, it } from "vitest";
import { computed, effect, flushSync, signal, untrack } from "./index.ts";
import { disposeOwner, MUTABLE, renderEffect, track, type TriggerNode } from "./internal.ts";
import { SIGNAL_NODE, type Signal } from "./signal.ts";

const subscriberCount = (s: Signal<unknown>): number => {
  let count = 0;
  for (let link = (s as never)[SIGNAL_NODE]["subs"] as { nextSub: unknown } | undefined; link;) {
    count++;
    link = link.nextSub as typeof link;
  }
  return count;
};

describe("signal", () => {
  it("reads, sets, updates and peeks", () => {
    const s = signal(1);
    expect(s()).toBe(1);
    s.set(2);
    expect(s()).toBe(2);
    s.update((n) => n + 10);
    expect(s.peek()).toBe(12);
  });

  it("reads reflect the latest write synchronously, even with effects pending", () => {
    const s = signal(0);
    const double = computed(() => s() * 2);
    effect(() => void s());
    s.set(5);
    expect(s()).toBe(5);
    expect(double()).toBe(10);
    flushSync();
  });

  it("peek does not track", () => {
    const a = signal(1);
    const b = signal(1);
    let runs = 0;
    effect(() => {
      runs++;
      a();
      b.peek();
    });
    flushSync();
    b.set(2);
    flushSync();
    expect(runs).toBe(1);
    a.set(2);
    flushSync();
    expect(runs).toBe(2);
  });

  it("uses Object.is by default (NaN is equal to itself, +0 differs from -0)", () => {
    const s = signal(Number.NaN);
    let runs = 0;
    effect(() => {
      runs++;
      s();
    });
    flushSync();
    s.set(Number.NaN);
    flushSync();
    expect(runs).toBe(1);
    const z = signal(0);
    let zRuns = 0;
    effect(() => {
      zRuns++;
      z();
    });
    flushSync();
    z.set(-0);
    flushSync();
    expect(zRuns).toBe(2);
  });

  it("supports custom equality and keeps the old value on equal writes", () => {
    const first = { id: 1, label: "a" };
    const s = signal(first, { equals: (a, b) => a.id === b.id });
    let runs = 0;
    effect(() => {
      runs++;
      s();
    });
    flushSync();
    s.set({ id: 1, label: "b" });
    flushSync();
    expect(runs).toBe(1);
    expect(s()).toBe(first);
    s.set({ id: 2, label: "c" });
    flushSync();
    expect(runs).toBe(2);
  });

  it("equals: false makes every write a change", () => {
    const list = [1];
    const s = signal(list, { equals: false });
    let runs = 0;
    effect(() => {
      runs++;
      s();
    });
    flushSync();
    list.push(2);
    s.set(list);
    flushSync();
    expect(runs).toBe(2);
  });

  it("writes that revert to the original value inside one flush do not notify", () => {
    const s = signal(1);
    let runs = 0;
    effect(() => {
      runs++;
      s();
    });
    flushSync();
    s.set(2);
    s.set(1);
    flushSync();
    expect(runs).toBe(1);
  });
});

describe("computed", () => {
  it("is lazy and cached while observed", () => {
    const s = signal(1);
    let evaluations = 0;
    const c = computed(() => {
      evaluations++;
      return s() * 2;
    });
    expect(evaluations).toBe(0);
    let seen = 0;
    effect(() => {
      seen = c();
    });
    flushSync();
    expect(seen).toBe(2);
    expect(evaluations).toBe(1);
    expect(c()).toBe(2);
    expect(c()).toBe(2);
    expect(evaluations).toBe(1);
    s.set(2);
    expect(c()).toBe(4);
    expect(evaluations).toBe(2);
    flushSync();
    expect(seen).toBe(4);
    expect(evaluations).toBe(2);
  });

  it("is glitch-free in a diamond", () => {
    const s = signal(1);
    const left = computed(() => s() + 1);
    const right = computed(() => s() * 10);
    let evaluations = 0;
    const sum = computed(() => {
      evaluations++;
      return left() + right();
    });
    const seen: number[] = [];
    effect(() => {
      seen.push(sum());
    });
    flushSync();
    s.set(2);
    flushSync();
    expect(seen).toEqual([12, 23]);
    expect(evaluations).toBe(2);
  });

  it("stops propagation when its value does not change", () => {
    const s = signal(1);
    const parity = computed(() => s() % 2);
    let downstream = 0;
    const label = computed(() => {
      downstream++;
      return parity() === 0 ? "even" : "odd";
    });
    let runs = 0;
    effect(() => {
      runs++;
      label();
    });
    flushSync();
    s.set(3);
    flushSync();
    expect(downstream).toBe(1);
    expect(runs).toBe(1);
    s.set(4);
    flushSync();
    expect(downstream).toBe(2);
    expect(runs).toBe(2);
  });

  it("supports custom equality", () => {
    const s = signal([1, 2]);
    const sorted = computed(() => s().toSorted(), {
      equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    });
    let runs = 0;
    effect(() => {
      runs++;
      sorted();
    });
    flushSync();
    const first = sorted();
    s.set([2, 1]);
    flushSync();
    expect(runs).toBe(1);
    expect(sorted()).toBe(first);
  });

  it("receives its previous value", () => {
    const s = signal(1);
    const history = computed<number[]>((prev) => [...(prev ?? []), s()]);
    effect(() => void history());
    flushSync();
    s.set(2);
    flushSync();
    expect(history()).toEqual([1, 2]);
  });

  it("tracks dynamic dependencies", () => {
    const useA = signal(true);
    const a = signal("a");
    const b = signal("b");
    let evaluations = 0;
    const picked = computed(() => {
      evaluations++;
      return useA() ? a() : b();
    });
    effect(() => void picked());
    flushSync();
    b.set("b2");
    flushSync();
    expect(evaluations).toBe(1);
    useA.set(false);
    flushSync();
    expect(picked()).toBe("b2");
    a.set("a2");
    flushSync();
    expect(evaluations).toBe(2);
    expect(subscriberCount(a as Signal<unknown>)).toBe(0);
  });

  it("unlinks from its sources when no longer observed", () => {
    const s = signal(1);
    let evaluations = 0;
    const c = computed(() => {
      evaluations++;
      return s() + 1;
    });
    const dispose = effect(() => void c());
    flushSync();
    expect(subscriberCount(s as Signal<unknown>)).toBe(1);
    dispose();
    expect(subscriberCount(s as Signal<unknown>)).toBe(0);
    s.set(5);
    expect(c()).toBe(6);
    expect(evaluations).toBe(2);
  });

  it("an unobserved computed read untracked never links to its sources", () => {
    const s = signal(1);
    const c = computed(() => s() * 3);
    expect(c()).toBe(3);
    expect(untrack(c)).toBe(3);
    expect(subscriberCount(s as Signal<unknown>)).toBe(0);
    s.set(2);
    expect(c()).toBe(6);
  });

  it("a computed chain observed by an effect unlinks completely on disposal", () => {
    const s = signal(1);
    const a = computed(() => s() + 1);
    const b = computed(() => a() + 1);
    const c = computed(() => b() + 1);
    const dispose = effect(() => void c());
    flushSync();
    expect(subscriberCount(s as Signal<unknown>)).toBe(1);
    dispose();
    expect(subscriberCount(s as Signal<unknown>)).toBe(0);
    expect(c()).toBe(4);
  });
});

describe("trigger nodes", () => {
  it("call their unwatched hook when the last subscriber goes", () => {
    const dropped: unknown[] = [];
    const node: TriggerNode = {
      subs: undefined,
      subsTail: undefined,
      flags: MUTABLE,
      unwatched: (n) => dropped.push(n),
    };
    const a = renderEffect(
      null,
      () => track(node),
      () => {},
    );
    const b = renderEffect(
      null,
      () => track(node),
      () => {},
    );
    disposeOwner(a);
    expect(dropped).toEqual([]);
    disposeOwner(b);
    expect(dropped).toEqual([node]);
  });
});
