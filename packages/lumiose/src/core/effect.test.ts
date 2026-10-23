import { describe, expect, it } from "vitest";
import { batch, computed, effect, flush, onCleanup, onMount, signal } from "./index.ts";
import {
  createOwner,
  disposeOwner,
  endBatch,
  getOwner,
  onError,
  renderEffect,
  runWithOwner,
  startBatch,
  type Owner,
} from "./internal.ts";

/** Creates `levels` nested owners and returns the deepest. */
const nested = (levels: number): Owner => {
  let owner = createOwner(undefined);
  for (let i = 1; i < levels; i++) {
    owner = createOwner(owner);
  }
  return owner;
};

/** A binding that copies `s` into `dom.value` and logs each later apply into `log`. */
const bound = (s: () => number, log: string[] = []) => {
  const dom = { value: "" };
  renderEffect(dom, s, (target, v) => {
    log.push(`render ${v}`);
    target.value = String(v);
  });
  log.length = 0;
  return dom;
};

describe("effect", () => {
  it("defers its first run to the next flush", () => {
    const log: string[] = [];
    effect(() => {
      log.push("run");
    });
    expect(log).toEqual([]);
    flush();
    expect(log).toEqual(["run"]);
  });

  it("flushes on a microtask when writes happen outside a batch", async () => {
    const s = signal(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(s());
    });
    await Promise.resolve();
    expect(seen).toEqual([0]);
    s.set(1);
    s.set(2);
    expect(seen).toEqual([0]);
    await Promise.resolve();
    expect(seen).toEqual([0, 2]);
  });

  it("runs the returned cleanup before each re-run and on disposal", () => {
    const s = signal(0);
    const log: string[] = [];
    const dispose = effect(() => {
      const v = s();
      log.push(`run ${v}`);
      onCleanup(() => log.push(`onCleanup ${v}`));
      return () => log.push(`cleanup ${v}`);
    });
    flush();
    s.set(1);
    flush();
    dispose();
    expect(log).toEqual(["run 0", "cleanup 0", "onCleanup 0", "run 1", "cleanup 1", "onCleanup 1"]);
  });

  it("disposes nested effects before re-running", () => {
    const outer = signal(0);
    const inner = signal(0);
    const log: string[] = [];
    effect(() => {
      const o = outer();
      effect(() => {
        log.push(`inner ${o}/${inner()}`);
        return () => log.push(`inner cleanup ${o}`);
      });
    });
    flush();
    inner.set(1);
    flush();
    outer.set(1);
    flush();
    expect(log).toEqual([
      "inner 0/0",
      "inner cleanup 0",
      "inner 0/1",
      "inner cleanup 0",
      "inner 1/1",
    ]);
  });

  it("never runs once disposed, even when already queued", () => {
    const s = signal(0);
    let runs = 0;
    const dispose = effect(() => {
      runs++;
      s();
    });
    flush();
    s.set(1);
    dispose();
    flush();
    expect(runs).toBe(1);
    const never = effect(() => {
      runs++;
    });
    never();
    flush();
    expect(runs).toBe(1);
  });

  it("is disposed with its owner", () => {
    const owner = createOwner(undefined);
    const s = signal(0);
    let runs = 0;
    runWithOwner(owner, () =>
      effect(() => {
        runs++;
        s();
      }),
    );
    flush();
    disposeOwner(owner);
    s.set(1);
    flush();
    expect(runs).toBe(1);
  });

  it("does not re-trigger itself through its own writes", () => {
    const s = signal(0);
    let runs = 0;
    effect(() => {
      runs++;
      s.set(s() + 1);
    });
    flush();
    expect(runs).toBe(1);
    expect(s()).toBe(1);
    s.set(10);
    flush();
    expect(runs).toBe(2);
    expect(s()).toBe(11);
  });

  it("still reacts to outside writes after writing a source it reads through a computed", () => {
    const s = signal(0);
    const double = computed(() => s() * 2);
    const seen: number[] = [];
    effect(() => {
      seen.push(double());
      if (s.peek() === 0) s.set(1);
    });
    flush();
    expect(seen).toEqual([0]);
    s.set(5);
    flush();
    expect(seen).toEqual([0, 10]);
  });

  it("re-runs effects downstream of writes made by another effect in the same flush", () => {
    const a = signal(0);
    const b = signal(0);
    const seen: number[] = [];
    effect(() => b.set(a() * 2));
    effect(() => {
      seen.push(b());
    });
    flush();
    a.set(1);
    flush();
    expect(seen).toEqual([0, 2]);
  });

  it("does not run when a pending computed turns out unchanged", () => {
    const s = signal(1);
    const positive = computed(() => s() > 0);
    let runs = 0;
    effect(() => {
      runs++;
      positive();
    });
    flush();
    s.set(2);
    flush();
    expect(runs).toBe(1);
  });
});

describe("onMount", () => {
  it("runs once, untracked, after the flush and cleans up with its owner", () => {
    const owner = createOwner(undefined);
    const s = signal(0);
    const log: string[] = [];
    runWithOwner(owner, () =>
      onMount(() => {
        log.push(`mount ${s()}`);
        return () => log.push("unmount");
      }),
    );
    expect(log).toEqual([]);
    flush();
    s.set(1);
    flush();
    expect(log).toEqual(["mount 0"]);
    disposeOwner(owner);
    expect(log).toEqual(["mount 0", "unmount"]);
  });
});

describe("batch", () => {
  it("runs effects once, at the end of the outermost batch", () => {
    const a = signal(0);
    const b = signal(0);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${a()},${b()}`);
    });
    flush();
    const result = batch(() => {
      a.set(1);
      batch(() => b.set(1));
      expect(seen).toEqual(["0,0"]);
      return "done";
    });
    expect(result).toBe("done");
    expect(seen).toEqual(["0,0", "1,1"]);
  });

  it("startBatch/endBatch work like batch (delegated handlers)", () => {
    const s = signal(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(s());
    });
    flush();
    startBatch();
    s.set(1);
    s.set(2);
    expect(seen).toEqual([0]);
    endBatch();
    expect(seen).toEqual([0, 2]);
  });

  it("flush inside a batch flushes immediately", () => {
    const s = signal(0);
    const seen: number[] = [];
    effect(() => {
      seen.push(s());
    });
    batch(() => {
      s.set(1);
      flush();
      expect(seen).toEqual([1]);
      s.set(2);
    });
    expect(seen).toEqual([1, 2]);
  });

  it("reads inside a batch see the latest writes", () => {
    const s = signal(1);
    const double = computed(() => s() * 2);
    batch(() => {
      s.set(4);
      expect(s()).toBe(4);
      expect(double()).toBe(8);
    });
  });
});

describe("render effects", () => {
  it("compute runs tracked; apply runs now and on change, with the target", () => {
    const s = signal("a");
    const target = { text: "" };
    const calls: string[] = [];
    const binding = renderEffect(target, s, (el, value) => {
      calls.push(value);
      el.text = value;
    });
    expect(target.text).toBe("a");
    s.set("b");
    expect(target.text).toBe("a");
    flush();
    expect(target.text).toBe("b");
    expect(calls).toEqual(["a", "b"]);
    disposeOwner(binding);
    s.set("c");
    flush();
    expect(target.text).toBe("b");
  });

  it("skips apply when the computed value is unchanged", () => {
    const s = signal(1);
    let applies = 0;
    renderEffect(
      null,
      () => s() > 0,
      () => applies++,
    );
    s.set(2);
    flush();
    expect(applies).toBe(1);
    s.set(-1);
    flush();
    expect(applies).toBe(2);
  });

  it("keeps the children created by apply until it is disposed", () => {
    const owner = createOwner(undefined);
    const show = signal(true);
    const log: string[] = [];
    let branch: Owner | undefined;
    runWithOwner(owner, () =>
      renderEffect(null, show, (_, visible) => {
        if (branch) disposeOwner(branch);
        else log.push("initial");
        branch = createOwner(getOwner());
        runWithOwner(branch, () => onCleanup(() => log.push(`dispose ${visible}`)));
      }),
    );
    show.set(false);
    flush();
    disposeOwner(owner);
    expect(log).toEqual(["initial", "dispose true", "dispose false"]);
  });

  it("run before user effects, parents before children", () => {
    const s = signal(0);
    const log: string[] = [];
    const deep = nested(3);
    const shallow = nested(1);
    effect(() => {
      s();
      log.push("user");
    });
    runWithOwner(deep, () => renderEffect(null, s, () => log.push("render depth 3")));
    runWithOwner(shallow, () => renderEffect(null, s, () => log.push("render depth 1")));
    flush();
    log.length = 0;
    s.set(1);
    flush();
    expect(log).toEqual(["render depth 1", "render depth 3", "user"]);
  });

  it("a parent that replaces a child binding runs first, so the old child never runs", () => {
    const p = signal(0);
    const c = signal(0);
    const log: string[] = [];
    const root = createOwner(undefined);
    let child: Owner | undefined;
    runWithOwner(root, () =>
      renderEffect(null, p, (_, v) => {
        if (child) disposeOwner(child);
        child = createOwner(root);
        runWithOwner(child, () => renderEffect(null, c, (__, cv) => log.push(`child ${v}:${cv}`)));
        log.push(`parent ${v}`);
      }),
    );
    // The child binding is notified first, but it is deeper than the parent.
    batch(() => {
      c.set(1);
      p.set(1);
    });
    expect(log).toEqual(["child 0:0", "parent 0", "child 1:1", "parent 1"]);
  });
});

describe("user effects in one flush (decision-80)", () => {
  it("a later effect of the same pass sees the new signal value but the old DOM", () => {
    const s = signal(0);
    const dom = bound(s);
    const seen: string[] = [];
    effect(() => {
      if (s() === 0) s.set(1);
    });
    effect(() => {
      seen.push(`${s()} ${dom.value}`);
    });
    flush();
    expect(seen).toEqual(["1 0"]);
    expect(dom.value).toBe("1");
  });

  it("runs every queued effect before the render work their writes trigger, once", () => {
    const log: string[] = [];
    const sources = [signal(0), signal(0), signal(0)];
    const doms = sources.map((s) => bound(s, log));
    sources.forEach((s, i) =>
      effect(() => {
        log.push(`effect ${i} sees ${doms.map((dom) => dom.value).join("")}`);
        s.set(1);
      }),
    );
    flush();
    expect(log).toEqual([
      "effect 0 sees 000",
      "effect 1 sees 000",
      "effect 2 sees 000",
      "render 1",
      "render 1",
      "render 1",
    ]);
  });

  it("an effect that depends on the written signal sees the new DOM in the next pass", () => {
    const trigger = signal(0);
    const s = signal(0);
    const dom = bound(s);
    const log: string[] = [];
    effect(() => {
      if (trigger() > 0) s.set(trigger());
    });
    effect(() => {
      log.push(`dependent ${s()} ${dom.value}`);
    });
    effect(() => {
      log.push(`later ${trigger()} ${s.peek()} ${dom.value}`);
    });
    flush();
    log.length = 0;
    trigger.set(1);
    flush();
    expect(log).toEqual(["later 1 1 0", "dependent 1 1"]);
  });

  it("render bindings still run before user effects within an update", () => {
    const s = signal(0);
    const dom = bound(s);
    const seen: string[] = [];
    effect(() => {
      seen.push(`${s()} ${dom.value}`);
    });
    flush();
    s.set(1);
    flush();
    expect(seen).toEqual(["0 0", "1 1"]);
  });

  it("flush() and batch() inside an effect do not apply its writes before the pass ends", () => {
    const a = signal(0);
    const b = signal(0);
    const domA = bound(a);
    const domB = bound(b);
    const seen: string[] = [];
    effect(() => {
      batch(() => a.set(1));
      flush();
      seen.push(`first ${domA.value}`);
    });
    effect(() => {
      b.set(1);
      seen.push(`second ${domA.value}${domB.value}`);
    });
    flush();
    expect(seen).toEqual(["first 0", "second 00"]);
    expect(`${domA.value}${domB.value}`).toBe("11");
  });

  it("a batch outside a flush queues its effects into one pass", () => {
    const a = signal(0);
    const b = signal(0);
    const x = signal(0);
    const y = signal(0);
    const log: string[] = [];
    bound(x, log);
    bound(y, log);
    effect(() => {
      x.set(a());
      log.push(`effect a ${a()}`);
    });
    effect(() => {
      y.set(b());
      log.push(`effect b ${b()}`);
    });
    flush();
    log.length = 0;
    batch(() => {
      a.set(1);
      batch(() => b.set(2));
    });
    expect(log).toEqual(["effect a 1", "effect b 2", "render 1", "render 2"]);
  });

  it("an effect in a subtree that an earlier effect's write replaces does not run", () => {
    const show = signal(true);
    const x = signal(0);
    const log: string[] = [];
    effect(() => {
      if (x() > 0) show.set(false);
    });
    flush();
    const root = createOwner(undefined);
    let branch: Owner | undefined;
    runWithOwner(root, () =>
      renderEffect(null, show, (_, visible) => {
        if (branch) disposeOwner(branch);
        branch = createOwner(getOwner());
        if (visible) {
          runWithOwner(branch, () =>
            effect(() => {
              log.push(`inner ${x()}`);
              return () => log.push("inner cleanup");
            }),
          );
        }
      }),
    );
    flush();
    // Both effects are queued; the first one's write hides the second one's subtree.
    x.set(1);
    flush();
    expect(log).toEqual(["inner 0", "inner cleanup"]);
    disposeOwner(root);
  });

  it("an effect still runs when the pending binding above it turns out unchanged", () => {
    const s = signal(1);
    const x = signal(0);
    const positive = computed(() => s() > 0);
    const log: string[] = [];
    let applies = 0;
    effect(() => {
      if (x() > 0) s.set(2);
    });
    flush();
    const root = createOwner(undefined);
    runWithOwner(root, () =>
      renderEffect(null, positive, () => {
        applies++;
        effect(() => {
          log.push(`inner ${x()}`);
        });
      }),
    );
    flush();
    x.set(1);
    flush();
    expect(log).toEqual(["inner 0", "inner 1"]);
    expect(applies).toBe(1);
    disposeOwner(root);
  });
});

describe("errors", () => {
  it("an effect that throws does not stop the others; the error is rethrown after the flush", () => {
    const s = signal(0);
    const log: string[] = [];
    effect(() => {
      if (s() === 1) throw new Error("boom");
    });
    effect(() => {
      log.push(`ran ${s()}`);
    });
    flush();
    s.set(1);
    expect(() => flush()).toThrow("boom");
    expect(log).toEqual(["ran 0", "ran 1"]);
    s.set(2);
    flush();
    expect(log).toEqual(["ran 0", "ran 1", "ran 2"]);
  });

  it("routes errors to the nearest onError handler", () => {
    const owner = createOwner(undefined);
    const caught: unknown[] = [];
    runWithOwner(owner, () => {
      onError((error) => caught.push(error));
      const child = createOwner(owner);
      runWithOwner(child, () =>
        effect(() => {
          throw new Error("handled");
        }),
      );
    });
    expect(() => flush()).not.toThrow();
    expect(caught).toHaveLength(1);
    expect((caught[0] as Error).message).toBe("handled");
  });

  it("cleanup errors do not stop other cleanups and are rethrown", () => {
    const owner = createOwner(undefined);
    const log: string[] = [];
    runWithOwner(owner, () => {
      onCleanup(() => log.push("first"));
      onCleanup(() => {
        throw new Error("cleanup failed");
      });
      onCleanup(() => log.push("third"));
    });
    expect(() => disposeOwner(owner)).toThrow("cleanup failed");
    expect(log).toEqual(["third", "first"]);
  });
});
