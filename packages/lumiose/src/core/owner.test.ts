import { describe, expect, it } from "vitest";
import {
  createContext,
  effect,
  flush,
  useContext,
  getAbortSignal,
  onCleanup,
  signal,
} from "./index.ts";
import {
  createOwner,
  disposeOwner,
  getOwner,
  renderEffect,
  runWithLazyOwner,
  runWithOwner,
  type Owner,
} from "./internal.ts";
import { currentOwner } from "./reactive.ts";

describe("owners", () => {
  it("getOwner/runWithOwner scope the current owner and restore it", () => {
    const a = createOwner(undefined);
    const b = createOwner(a);
    expect(getOwner()).toBeUndefined();
    runWithOwner(a, () => {
      expect(getOwner()).toBe(a);
      runWithOwner(b, () => expect(getOwner()).toBe(b));
      expect(getOwner()).toBe(a);
    });
    expect(getOwner()).toBeUndefined();
    expect(b.parent).toBe(a);
    expect(b.depth).toBe(1);
  });

  it("disposes children newest-first, then runs own cleanups in reverse order", () => {
    const log: string[] = [];
    const root = createOwner(undefined);
    runWithOwner(root, () => {
      onCleanup(() => log.push("root 1"));
      for (const name of ["a", "b"]) {
        const child = createOwner(root);
        runWithOwner(child, () => {
          onCleanup(() => log.push(`${name} 1`));
          onCleanup(() => log.push(`${name} 2`));
          const grandchild = createOwner(child);
          runWithOwner(grandchild, () => onCleanup(() => log.push(`${name}.x`)));
        });
      }
      onCleanup(() => log.push("root 2"));
    });
    disposeOwner(root);
    expect(log).toEqual(["b.x", "b 2", "b 1", "a.x", "a 2", "a 1", "root 2", "root 1"]);
  });

  it("disposing a child detaches it from its parent", () => {
    const log: string[] = [];
    const root = createOwner(undefined);
    const children = [0, 1, 2].map((i) => {
      const child = createOwner(root);
      runWithOwner(child, () => onCleanup(() => log.push(`child ${i}`)));
      return child;
    });
    disposeOwner(children[1]!);
    expect(log).toEqual(["child 1"]);
    disposeOwner(root);
    expect(log).toEqual(["child 1", "child 2", "child 0"]);
    disposeOwner(children[0]!);
    expect(log).toHaveLength(3);
  });

  it("a disposed owner runs late cleanups at once and adopts children as disposed", () => {
    const root = createOwner(undefined);
    disposeOwner(root);
    const log: string[] = [];
    runWithOwner(root, () => onCleanup(() => log.push("late")));
    expect(log).toEqual(["late"]);
    const child = createOwner(root);
    let runs = 0;
    runWithOwner(child, () =>
      effect(() => {
        runs++;
      }),
    );
    flush();
    expect(runs).toBe(0);
  });

  it("onCleanup with no owner is ignored", () => {
    expect(() => onCleanup(() => {})).not.toThrow();
  });

  it("disposing an owner unlinks its bindings from their sources", () => {
    const root = createOwner(undefined);
    const s = signal(0);
    let applies = 0;
    runWithOwner(root, () => {
      renderEffect(null, s, () => applies++);
      renderEffect(null, s, () => applies++);
    });
    disposeOwner(root);
    s.set(1);
    flush();
    expect(applies).toBe(2);
  });
});

describe("lazy owners", () => {
  it("allocates nothing when nothing registers", () => {
    const parent = createOwner(undefined);
    const owner = runWithLazyOwner(parent, () => {
      useContext(createContext(0));
    });
    expect(owner).toBeUndefined();
    expect(parent.firstChild).toBeUndefined();
  });

  it("materializes on the first registration and reuses that owner", () => {
    const parent = createOwner(undefined);
    const log: string[] = [];
    const s = signal(0);
    const owner = runWithLazyOwner(parent, () => {
      onCleanup(() => log.push("cleanup"));
      renderEffect(null, s, () => {});
      expect(getOwner()).toBe(parent.firstChild);
    });
    expect(owner).toBeDefined();
    expect(owner!.parent).toBe(parent);
    expect(parent.firstChild).toBe(owner);
    expect(owner!.firstChild).toBeDefined();
    disposeOwner(owner!);
    expect(log).toEqual(["cleanup"]);
    expect(parent.firstChild).toBeUndefined();
  });

  it("resolves context through the parent without materializing", () => {
    const Theme = createContext("light");
    const parent = createOwner(undefined);
    runWithOwner(parent, () => Theme({ value: "dark" }));
    let seen = "";
    const owner = runWithLazyOwner(parent, () => {
      seen = useContext(Theme);
    });
    expect(seen).toBe("dark");
    expect(owner).toBeUndefined();
  });

  it("nests under a pending lazy owner without allocating", () => {
    const Theme = createContext("light");
    const parent = createOwner(undefined);
    runWithOwner(parent, () => Theme({ value: "dark" }));
    let seen = "";
    let inner: Owner | undefined = parent;
    const outer = runWithLazyOwner(parent, () => {
      inner = runWithLazyOwner(currentOwner, () => {
        seen = useContext(Theme);
      });
    });
    expect(seen).toBe("dark");
    expect(inner).toBeUndefined();
    expect(outer).toBeUndefined();
    expect(parent.firstChild).toBeUndefined();
  });

  it("materializes pending outer owners first when a nested one registers", () => {
    const parent = createOwner(undefined);
    const log: string[] = [];
    let inner: Owner | undefined;
    let deep: Owner | undefined;
    const outer = runWithLazyOwner(parent, () => {
      inner = runWithLazyOwner(currentOwner, () => {
        deep = runWithLazyOwner(currentOwner, () => onCleanup(() => log.push("deep")));
      });
      // The outer frame sees the owner its nested frame materialized.
      expect(getOwner()).toBe(inner!.parent);
    });
    expect(outer!.parent).toBe(parent);
    expect(inner!.parent).toBe(outer);
    expect(deep!.parent).toBe(inner);
    expect(deep!.depth).toBe(3);
    disposeOwner(outer!);
    expect(log).toEqual(["deep"]);
  });

  it("nests and restores the outer owner", () => {
    const parent = createOwner(undefined);
    let inner: Owner | undefined;
    const outer = runWithLazyOwner(parent, () => {
      const self = getOwner();
      inner = runWithLazyOwner(self, () => onCleanup(() => {}));
      expect(getOwner()).toBe(self);
    });
    expect(outer).toBeDefined();
    expect(inner!.parent).toBe(outer);
    expect(getOwner()).toBeUndefined();
  });
});

describe("lifetime", () => {
  it("aborts when the owner is disposed", () => {
    const owner = createOwner(undefined);
    const signalA = runWithOwner(owner, getAbortSignal);
    expect(runWithOwner(owner, getAbortSignal)).toBe(signalA);
    expect(signalA.aborted).toBe(false);
    disposeOwner(owner);
    expect(signalA.aborted).toBe(true);
    expect(runWithOwner(owner, getAbortSignal).aborted).toBe(true);
  });

  it("aborts each effect run's signal when the effect re-runs", () => {
    const s = signal(0);
    const signals: AbortSignal[] = [];
    const dispose = effect(() => {
      s();
      signals.push(getAbortSignal());
    });
    flush();
    s.set(1);
    flush();
    expect(signals).toHaveLength(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(signals[1]!.aborted).toBe(false);
    dispose();
    expect(signals[1]!.aborted).toBe(true);
  });

  it("throws outside an owner", () => {
    expect(() => getAbortSignal()).toThrow(/getAbortSignal\(\)/);
  });
});

describe("context", () => {
  it("returns the default value without a provider", () => {
    const Ctx = createContext(42);
    expect(useContext(Ctx)).toBe(42);
    expect(useContext(createContext<string>())).toBeUndefined();
  });

  it("reads the nearest provided value, with shadowing", () => {
    const Ctx = createContext("default");
    const root = createOwner(undefined);
    const mid = createOwner(root);
    const leaf = createOwner(mid);
    runWithOwner(root, () => Ctx({ value: "root" }));
    expect(runWithOwner(leaf, () => useContext(Ctx))).toBe("root");
    runWithOwner(mid, () => Ctx({ value: "mid" }));
    expect(runWithOwner(leaf, () => useContext(Ctx))).toBe("mid");
    expect(runWithOwner(root, () => useContext(Ctx))).toBe("root");
  });

  it("provides undefined values explicitly", () => {
    const Ctx = createContext<string | undefined>("default");
    const root = createOwner(undefined);
    runWithOwner(root, () => Ctx({ value: undefined }));
    expect(runWithOwner(root, () => useContext(Ctx))).toBeUndefined();
  });

  it("is visible inside effects created under the provider", () => {
    const Ctx = createContext(0);
    const root = createOwner(undefined);
    let seen = -1;
    runWithOwner(root, () => {
      Ctx({ value: 7 });
      effect(() => {
        seen = useContext(Ctx);
      });
    });
    flush();
    expect(seen).toBe(7);
  });

  it("works across await once the owner is restored", async () => {
    const Ctx = createContext("none");
    const root = createOwner(undefined);
    const result = await runWithOwner(root, async () => {
      Ctx({ value: "provided" });
      const owner = getOwner();
      await Promise.resolve();
      return runWithOwner(owner, () => useContext(Ctx));
    });
    expect(result).toBe("provided");
  });
});
