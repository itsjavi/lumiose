// Stand-ins for the layout that happy-dom lacks, for the virtualizer's DOM tests: ResizeObservers
// the test fires by hand, animation frames it runs by hand, and an innerHeight.
import { flush } from "lumiose";
import { vi } from "vitest";

export class FakeObserver {
  callback: ResizeObserverCallback;
  targets = new Set<Element>();
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  /** Reports `targets` at `size` px tall (or each at its own size). */
  fire(targets: Element[], size: number | ((target: Element) => number)) {
    const entries = targets.map((target) => ({
      target,
      borderBoxSize: [{ blockSize: typeof size === "number" ? size : size(target) }],
    }));
    this.callback(entries as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

export let observers: FakeObserver[] = [];
let frames: FrameRequestCallback[] = [];

/** Runs the pending animation frames, then renders. */
export function frame(): void {
  const pending = frames;
  frames = [];
  for (const callback of pending) callback(0);
  flush();
}

/** The observer that watches `target`. */
export const observerOf = (target: Element): FakeObserver | undefined =>
  observers.find((observer) => observer.targets.has(target));

/** Installs the stand-ins, with a viewport `height` px tall. Undo with `vi.unstubAllGlobals()`. */
export function installLayout(height = 500): void {
  observers = [];
  frames = [];
  vi.stubGlobal("ResizeObserver", FakeObserver);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("innerHeight", height);
}
