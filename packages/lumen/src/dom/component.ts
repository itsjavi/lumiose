// Components and reactive props utilities (contract doc-2 §1-2, spec §4.2).
import type { Component, Renderable } from "../contract/client.ts";
import { currentOwner, runWithLazyOwner, setActiveSub } from "../core/internal.ts";

const AsyncFunction = (async () => {}).constructor;

// Arguments and result of `runComponent`, passed without a closure. A nested component overwrites
// them only after the outer call has read its arguments, and the outer call writes the result last.
let componentFn: Component<any> | undefined;
let componentProps: unknown;
let componentResult: Renderable;

function runComponent(): void {
  componentResult = componentFn!(componentProps) as Renderable;
}

/**
 * Runs a component once, untracked, under a new lazy owner (allocated only if the component
 * registers a cleanup, an effect, a binding or a provided value). The owner's parent may itself be
 * lazy, so components inside list rows stay allocation-free too.
 */
export function createComponent<P>(component: Component<P>, props: P): Renderable {
  if (component instanceof AsyncFunction) {
    throw new Error(
      `lumen: async component ${component.name || "(anonymous)"} cannot render on the client yet (TASK-17).`,
    );
  }
  componentFn = component;
  componentProps = props;
  const prevSub = setActiveSub(undefined);
  try {
    runWithLazyOwner(currentOwner, runComponent);
  } finally {
    setActiveSub(prevSub);
  }
  const result = componentResult;
  componentFn = componentProps = componentResult = undefined;
  return result;
}

/**
 * `...rest` of destructured props: every own property except `keys`, copied as descriptors so
 * getters stay live. The key set is taken now.
 */
export function restProps<P extends object, K extends keyof P>(
  props: P,
  keys: readonly K[],
): Omit<P, K> {
  const descriptors = Object.getOwnPropertyDescriptors(props) as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  for (const key of keys) {
    delete descriptors[key];
  }
  return Object.defineProperties({}, descriptors) as Omit<P, K>;
}

/**
 * Merges props sources left to right, like object spread but keeping getters live. The key set is
 * taken now; a later source wins for a key it has, even when its value is `undefined`.
 */
export function mergeProps<P extends object>(...sources: P[]): P {
  const out = {} as P;
  for (const source of sources) {
    if (source != null) {
      Object.defineProperties(out, Object.getOwnPropertyDescriptors(source));
    }
  }
  return out;
}

function notImplemented(name: string): Error {
  return new Error(`lumen: ${name} is not implemented on the client yet (TASK-17).`);
}

/** Async component await (contract doc-2 §4). Implemented by TASK-17. */
export function $await<T>(
  _thunk: () => T | PromiseLike<T>,
  _site: number,
): Promise<() => Awaited<T>> {
  throw notImplemented("$await");
}

/** Async component exit (contract doc-2 §4). Implemented by TASK-17. */
export function $leave(): void {
  throw notImplemented("$leave");
}
