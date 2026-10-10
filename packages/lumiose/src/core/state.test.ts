// Scoped state in the browser (TASK-193): one instance per page, created on first use, outside the
// component tree; `resetStates()` (the Vitest setup's hook) starts fresh instances.
import { describe, expect, it } from "vitest";
import {
  computed,
  defineState,
  effect,
  flush,
  signal,
  useContext,
  createContext,
} from "./index.ts";
import { createOwner, disposeOwner, runWithOwner } from "./internal.ts";
import { resetStates, setStateRestore } from "./state.ts";

describe("defineState (browser)", () => {
  it("runs the factory on first use, once, and shares the instance", () => {
    let runs = 0;
    const counter = defineState(() => {
      runs++;
      return { count: signal(0) };
    });
    expect(runs).toBe(0);
    const a = counter();
    const b = counter();
    expect(runs).toBe(1);
    expect(a).toBe(b);
    a.count.set(2);
    expect(counter().count()).toBe(2);
  });

  it("gives fresh instances after resetStates()", () => {
    const counter = defineState(() => ({ count: signal(0) }));
    counter().count.set(5);
    const before = counter();
    resetStates();
    expect(counter()).not.toBe(before);
    expect(counter().count()).toBe(0);
  });

  it("runs the factory untracked, with no owner and no context", () => {
    const source = signal(1);
    const Theme = createContext("default");
    let seen: string | undefined;
    const derived = defineState(() => {
      seen = useContext(Theme);
      const copy = signal(source());
      const log: number[] = [];
      effect(() => {
        log.push(copy());
      });
      return { copy, log };
    });
    const owner = createOwner(undefined);
    owner.context = { [Theme.id]: "page" };
    const reads: number[] = [];
    runWithOwner(owner, () => {
      effect(() => {
        reads.push(derived().copy.peek());
      });
    });
    flush();
    expect(seen).toBe("default");
    // The caller's effect did not subscribe to what the factory read.
    source.set(2);
    flush();
    expect(reads).toEqual([1]);
    // The factory's effect outlives the owner that first asked for the state.
    disposeOwner(owner);
    derived().copy.set(3);
    flush();
    expect(derived().log).toEqual([1, 3]);
  });

  it("passes each new instance through the restore hook", () => {
    const seen: unknown[] = [];
    setStateRestore((read) => {
      seen.push((read as { $$id?: string }).$$id);
    });
    try {
      const state = Object.assign(
        defineState(() => ({ doubled: computed(() => 2) })),
        { $$id: "/src/a.ts#state" },
      );
      state();
      state();
      expect(seen).toEqual(["/src/a.ts#state"]);
    } finally {
      setStateRestore(() => {});
    }
  });
});
