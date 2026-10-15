// Components and reactive props utilities (contract doc-2 §1-2, spec §4.2).
import type { Component, Renderable } from "../contract/client.ts";
import { currentOwner, runWithLazyOwner, setActiveSub } from "../core/internal.ts";
import { enterComponent, exitComponent } from "./devtools.ts";
import { createAsync, type AsyncTagged } from "./async.ts";
import { childFrame, frame, setFrame } from "./frame.ts";
import { DEV, INSPECTED } from "./dev.ts";

/** Untagged async components already warned about (dev only). */
let warned: WeakSet<object> | undefined;

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
 *
 * An async component takes the async path (./async.ts) and renders into a range of its own. The
 * compiler tags async components with `$async`, which stores that path on the component, so it is
 * bundled only when an app has async components (contract doc-2 §4). In development, an untagged
 * native `async function` (for example from a library not compiled by Lumiose) gets a warning and
 * still works.
 */
export function createComponent<P>(component: Component<P>, props: P): Renderable {
  const tagged = (component as AsyncTagged).$$async;
  if (import.meta.env?.DEV && INSPECTED && tagged !== undefined) {
    const record = enterComponent(component, props);
    let result: Renderable;
    try {
      return (result = tagged(component, props));
    } finally {
      exitComponent(record, result);
    }
  }
  if (tagged !== undefined) {
    return tagged(component, props);
  }
  if (DEV && component instanceof (async () => {}).constructor) {
    if (!(warned ??= new WeakSet()).has(component)) {
      warned.add(component);
      console.warn(
        `Lumiose: the async component ${component.name || "(anonymous)"} is not wrapped in $async(), so production builds render it as a plain component. Compile it with Lumiose or wrap it: $async(async function ${component.name || "C"}(props) { … }).`,
      );
    }
    return createAsync(component as (props: P) => Promise<Renderable>, props);
  }
  componentFn = component;
  componentProps = props;
  const record = import.meta.env?.DEV && INSPECTED ? enterComponent(component, props) : undefined;
  const prevSub = setActiveSub(undefined);
  // Instance paths exist only while an island hydrates (./frame.ts).
  const prevFrame = frame;
  if (prevFrame !== undefined) {
    setFrame!(childFrame(prevFrame));
  }
  try {
    runWithLazyOwner(currentOwner, runComponent);
  } finally {
    if (import.meta.env?.DEV && INSPECTED) exitComponent(record, componentResult);
    setActiveSub(prevSub);
    if (prevFrame !== undefined) {
      setFrame!(prevFrame);
    }
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
