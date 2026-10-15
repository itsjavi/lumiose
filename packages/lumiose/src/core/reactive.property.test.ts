// Property-based tests: random graphs of signals, computeds and effects are driven by
// random writes, reads, batches and flushes, and checked against a naive reference that
// recomputes everything from the current signal values.
import { describe, expect, it, vi } from "vitest";
import { batch, effect, flush, store } from "./index.ts";

// At the nightly case count the scenarios run for minutes: the timeout grows with the count, as in
// app/server/__fixtures__/property.ts (TASK-344).
vi.setConfig({
  testTimeout: Math.max(10_000, Number(process.env.LUMIOSE_PROPERTY_RUNS ?? 0) * 25),
});
import {
  createComputedNode,
  createSignalNode,
  readComputed,
  readSignal,
  writeSignal,
  type ComputedNode,
  type SignalNode,
} from "./reactive.ts";

/**
 * The seeds of a test: 1 to `base`, or one per 10 cases of `LUMIOSE_PROPERTY_RUNS` when that is
 * more (`pnpm --filter lumiose test:properties [runs]`, the nightly workflow); only
 * `LUMIOSE_PROPERTY_SEED` when set, to reproduce a failure (it prints its seed).
 */
function seeds(base: number): number[] {
  const only = process.env.LUMIOSE_PROPERTY_SEED;
  if (only !== undefined) return [Number(only)];
  const count = Math.max(base, Math.floor(Number(process.env.LUMIOSE_PROPERTY_RUNS ?? 0) / 10));
  return Array.from({ length: count }, (_, i) => i + 1);
}

/** mulberry32: a small seeded PRNG, so failures are reproducible from the seed. */
function createRandom(seed: number): { next: () => number; int: (n: number) => number } {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

type Op = "sum" | "max" | "parity" | "cond";
interface Def {
  op: Op;
  deps: number[];
}

const OPS: Op[] = ["sum", "max", "parity", "cond"];
const VALUES = 5;

function randomDef(random: ReturnType<typeof createRandom>, available: number): Def {
  const op = OPS[random.int(OPS.length)]!;
  const count = op === "parity" ? 1 : op === "cond" ? 3 : 1 + random.int(3);
  return { op, deps: Array.from({ length: count }, () => random.int(available)) };
}

/** Values stay in 0..4 so equal results (and equality cut-offs) are frequent; `cond` reads dynamically. */
function evaluate(def: Def, read: (i: number) => number): number {
  switch (def.op) {
    case "sum": {
      let sum = 0;
      for (const dep of def.deps) sum += read(dep);
      return sum % VALUES;
    }
    case "max": {
      let max = 0;
      for (const dep of def.deps) max = Math.max(max, read(dep));
      return max;
    }
    case "parity":
      return read(def.deps[0]!) % 2;
    case "cond":
      return read(def.deps[0]!) >= 2 ? read(def.deps[1]!) : read(def.deps[2]!);
  }
}

interface Watcher {
  def: Def;
  runs: number;
  reads: [node: number, value: number][];
  dispose: () => void;
}

function hasSubscribers(node: { subs?: unknown }): boolean {
  return node.subs !== undefined;
}

function runScenario(seed: number, steps: number): string[] {
  const random = createRandom(seed);
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(`seed ${seed}: ${message}`);
  };

  const signalCount = 2 + random.int(4);
  const nodeCount = signalCount + 3 + random.int(10);
  const defs: Def[] = [];
  for (let i = signalCount; i < nodeCount; i++) defs[i] = randomDef(random, i);

  // Naive reference: signal values plus memoized-per-state recomputation.
  const model = Array.from({ length: signalCount }, () => random.int(VALUES));
  let memo = new Map<number, number>();
  const refValue = (i: number): number => {
    if (i < signalCount) return model[i]!;
    let value = memo.get(i);
    if (value === undefined) {
      value = evaluate(defs[i]!, refValue);
      memo.set(i, value);
    }
    return value;
  };
  const refReads = (i: number): Set<number> => {
    const reads = new Set<number>();
    evaluate(defs[i]!, (j) => {
      reads.add(j);
      return refValue(j);
    });
    return reads;
  };

  // Lumiose graph built from the same definitions.
  const signals: SignalNode<number>[] = model.map((v) => createSignalNode(v, Object.is));
  const computeds: ComputedNode<number>[] = [];
  const evaluations: number[] = [];
  const read = (j: number): number =>
    j < signalCount ? readSignal(signals[j]!) : readComputed(computeds[j]!);
  for (let i = signalCount; i < nodeCount; i++) {
    evaluations[i] = 0;
    computeds[i] = createComputedNode(() => {
      evaluations[i]!++;
      return evaluate(defs[i]!, read);
    }, Object.is);
  }

  const watchers: Watcher[] = [];
  const addWatcher = (): void => {
    const watcher: Watcher = {
      def: randomDef(random, nodeCount),
      runs: 0,
      reads: [],
      dispose: () => {},
    };
    watcher.dispose = effect(() => {
      const reads: [number, number][] = [];
      evaluate(watcher.def, (j) => {
        const value = read(j);
        if (value !== refValue(j))
          fail(`effect read node ${j} = ${value}, expected ${refValue(j)}`);
        reads.push([j, value]);
        return value;
      });
      watcher.reads = reads;
      watcher.runs++;
    });
    watchers.push(watcher);
  };
  for (let i = 1 + random.int(4); i > 0; i--) addWatcher();

  let wrote = false;
  let readAfterWrite = false;

  const write = (): void => {
    const i = random.int(signalCount);
    const value = random.int(VALUES);
    model[i] = value;
    memo = new Map();
    writeSignal(signals[i]!, value);
    wrote = true;
  };

  /** Flushes (directly or as a batch) and checks which effects ran. */
  const flushAndCheck = (run: (expect: () => void) => void): void => {
    let expectations: { watcher: Watcher; before: number; due: boolean }[] = [];
    const snapshot = (): void => {
      expectations = watchers.map((watcher) => ({
        watcher,
        before: watcher.runs,
        due: watcher.runs === 0 || watcher.reads.some(([j, v]) => refValue(j) !== v),
      }));
    };
    run(snapshot);
    // Without reads between writes, an effect runs exactly when a value it read changed.
    // Reads in between may settle values early, which can only add (harmless) extra runs.
    const precise = !readAfterWrite;
    for (const { watcher, before, due } of expectations) {
      const delta = watcher.runs - before;
      if (delta > 1) fail(`effect ran ${delta} times in one flush`);
      if (due && delta === 0) fail(`effect missed an update`);
      if (precise && !due && delta !== 0) fail(`effect ran without a changed dependency`);
    }
    wrote = false;
    readAfterWrite = false;
    checkLinks();
  };

  /** After a flush, exactly the observed nodes have subscribers; the rest hold no links. */
  const checkLinks = (): void => {
    const observed = new Set<number>();
    const visit = (j: number): void => {
      if (observed.has(j)) return;
      observed.add(j);
      if (j >= signalCount) for (const k of refReads(j)) visit(k);
    };
    for (const watcher of watchers) for (const [j] of watcher.reads) visit(j);
    for (let j = 0; j < nodeCount; j++) {
      const node = j < signalCount ? signals[j]! : computeds[j]!;
      if (hasSubscribers(node) !== observed.has(j)) {
        fail(`node ${j} has subscribers: ${hasSubscribers(node)}, observed: ${observed.has(j)}`);
      }
      if (j >= signalCount && !observed.has(j) && computeds[j]!.deps !== undefined) {
        fail(`unobserved computed ${j} still holds links`);
      }
    }
    // Observed computeds are cached: reading them again does not re-evaluate.
    for (const j of observed) {
      if (j < signalCount) continue;
      const before = evaluations[j]!;
      const value = readComputed(computeds[j]!);
      if (value !== refValue(j)) fail(`computed ${j} = ${value}, expected ${refValue(j)}`);
      if (evaluations[j] !== before) fail(`observed computed ${j} re-evaluated without a change`);
    }
  };

  flushAndCheck((snapshot) => {
    snapshot();
    flush();
  });

  for (let step = 0; step < steps; step++) {
    const roll = random.next();
    if (roll < 0.4) {
      write();
    } else if (roll < 0.55) {
      const j = random.int(nodeCount);
      const value = read(j);
      if (value !== refValue(j)) fail(`read node ${j} = ${value}, expected ${refValue(j)}`);
      if (wrote) readAfterWrite = true;
    } else if (roll < 0.72) {
      flushAndCheck((snapshot) => {
        snapshot();
        flush();
      });
    } else if (roll < 0.82) {
      flushAndCheck((snapshot) =>
        batch(() => {
          for (let n = 1 + random.int(4); n > 0; n--) write();
          snapshot();
        }),
      );
    } else if (roll < 0.91) {
      addWatcher();
    } else if (watchers.length > 0) {
      const [watcher] = watchers.splice(random.int(watchers.length), 1);
      watcher!.dispose();
    }
  }

  flushAndCheck((snapshot) => {
    snapshot();
    flush();
  });
  for (const watcher of watchers.splice(0)) watcher.dispose();
  for (let j = 0; j < nodeCount; j++) {
    const node = j < signalCount ? signals[j]! : computeds[j]!;
    if (hasSubscribers(node))
      fail(`node ${j} still has subscribers after every effect was disposed`);
  }
  return failures;
}

describe("reactive core vs a naive reference", () => {
  it("agrees on values, effect runs and links for random graphs", () => {
    const failures: string[] = [];
    for (const seed of seeds(400)) {
      failures.push(...runScenario(seed, 80));
      if (failures.length > 0) break;
    }
    expect(failures).toEqual([]);
  });

  it("reaches the reference fixed point when effects write signals during the flush", () => {
    const failures: string[] = [];
    for (const seed of seeds(300)) {
      failures.push(...runCascadeScenario(seed, 60));
      if (failures.length > 0) break;
    }
    expect(failures).toEqual([]);
  });
});

/**
 * Some signals are "sinks" written only by writer effects. Writer `k` reads nodes that do
 * not depend on sink `k` or later sinks, so the cascade is acyclic and settles. After each
 * flush, every live effect must agree with the reference evaluated at the current values.
 */
function runCascadeScenario(seed: number, steps: number): string[] {
  const random = createRandom(seed);
  const failures: string[] = [];
  const fail = (message: string): void => {
    failures.push(`seed ${seed}: ${message}`);
  };

  const sourceCount = 2 + random.int(3);
  const signalCount = sourceCount + 1 + random.int(3);
  const nodeCount = signalCount + 3 + random.int(8);
  const defs: Def[] = [];
  const closure: Set<number>[] = [];
  for (let i = 0; i < nodeCount; i++) {
    closure[i] = new Set([i]);
    if (i >= signalCount) {
      defs[i] = randomDef(random, i);
      for (const dep of defs[i]!.deps) for (const k of closure[dep]!) closure[i]!.add(k);
    }
  }

  const model = Array.from({ length: signalCount }, () => random.int(VALUES));
  let memo = new Map<number, number>();
  const refValue = (i: number): number => {
    if (i < signalCount) return model[i]!;
    let value = memo.get(i);
    if (value === undefined) {
      value = evaluate(defs[i]!, refValue);
      memo.set(i, value);
    }
    return value;
  };
  const setModel = (i: number, value: number): void => {
    model[i] = value;
    memo = new Map();
  };

  const signals: SignalNode<number>[] = model.map((v) => createSignalNode(v, Object.is));
  const computeds: ComputedNode<number>[] = [];
  const read = (j: number): number => {
    const value = j < signalCount ? readSignal(signals[j]!) : readComputed(computeds[j]!);
    if (value !== refValue(j)) fail(`read node ${j} = ${value}, expected ${refValue(j)}`);
    return value;
  };
  for (let i = signalCount; i < nodeCount; i++) {
    computeds[i] = createComputedNode(() => evaluate(defs[i]!, read), Object.is);
  }

  interface Live {
    def: Def;
    sink: number | undefined;
    reads: number[];
    dispose: () => void;
  }
  const live: Live[] = [];
  const spawn = (sink: number | undefined): void => {
    const candidates: number[] = [];
    for (let j = 0; j < nodeCount; j++) {
      if (sink === undefined || ![...closure[j]!].some((k) => k >= sink && k < signalCount))
        candidates.push(j);
    }
    const def = randomDef(random, candidates.length);
    def.deps = def.deps.map((d) => candidates[d]!);
    const entry: Live = { def, sink, reads: [], dispose: () => {} };
    entry.dispose = effect(() => {
      const reads: number[] = [];
      const value = evaluate(def, (j) => {
        reads.push(j);
        return read(j);
      });
      entry.reads = reads;
      if (sink !== undefined) {
        setModel(sink, value);
        writeSignal(signals[sink]!, value);
      }
    });
    live.push(entry);
  };
  for (let sink = sourceCount; sink < signalCount; sink++) spawn(sink);
  for (let i = 1 + random.int(3); i > 0; i--) spawn(undefined);

  const check = (): void => {
    for (const entry of live) {
      const value = evaluate(entry.def, refValue);
      if (entry.sink !== undefined && model[entry.sink] !== value) {
        fail(`sink ${entry.sink} = ${model[entry.sink]}, expected ${value}`);
      }
      const reads: number[] = [];
      evaluate(entry.def, (j) => {
        reads.push(j);
        return refValue(j);
      });
      if (reads.join() !== entry.reads.join())
        fail(`effect read [${entry.reads}], expected [${reads}]`);
    }
  };

  flush();
  check();
  for (let step = 0; step < steps; step++) {
    const roll = random.next();
    if (roll < 0.5) {
      const i = random.int(sourceCount);
      const value = random.int(VALUES);
      setModel(i, value);
      writeSignal(signals[i]!, value);
    } else if (roll < 0.6) {
      read(random.int(nodeCount));
    } else if (roll < 0.85) {
      flush();
      check();
    } else if (roll < 0.92) {
      spawn(undefined);
    } else {
      const index = random.int(live.length);
      if (live[index]!.sink === undefined) live.splice(index, 1)[0]!.dispose();
    }
  }
  flush();
  check();
  for (const entry of live.splice(0)) entry.dispose();
  return failures;
}

describe("store vs a plain array", () => {
  it("agrees after random mutations", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = createRandom(seed);
      const plain: { v: number }[] = [];
      const reactive = store<{ v: number }[]>([]);
      let seenLength = -1;
      let seenSum = -1;
      let seenFirst: number | undefined = -1;
      const dispose = effect(() => {
        seenLength = reactive.length;
        seenSum = reactive.reduce((acc, item) => acc + item.v, 0);
        seenFirst = reactive[0]?.v;
      });
      for (let step = 0; step < 40; step++) {
        const roll = random.int(7);
        const value = random.int(10);
        const index = random.int(plain.length + 1);
        const count = random.int(3);
        for (const target of [plain, reactive]) {
          if (roll === 0) target.push({ v: value });
          else if (roll === 1) target.pop();
          else if (roll === 2) target.splice(index, count, { v: value });
          else if (roll === 3) target.unshift({ v: value });
          else if (roll === 4 && index < target.length) target[index]!.v = value;
          else if (roll === 5) target.reverse();
          else if (roll === 6) target.length = Math.min(target.length, index);
        }
        if (random.int(3) === 0) {
          flush();
          const sum = plain.reduce((acc, item) => acc + item.v, 0);
          expect([seenLength, seenSum, seenFirst], `seed ${seed} step ${step}`).toEqual([
            plain.length,
            sum,
            plain[0]?.v,
          ]);
        }
      }
      expect(JSON.stringify(reactive)).toBe(JSON.stringify(plain));
      dispose();
    }
  });
});
