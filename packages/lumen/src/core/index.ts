// Reactive core (owner: Spark): the public API re-exported by `lumen`. Spec §4.3, §6.1-6.2.
// Runtime-facing hooks (owners, render effects, async runs) are in ./internal.ts.
export { signal, computed, type Signal, type Computed, type SignalOptions } from "./signal.ts";
export { effect, batch, flushSync, onMount, type EffectFn } from "./effect.ts";
export { untrack } from "./reactive.ts";
export { store } from "./store.ts";
export { onCleanup, lifetime } from "./owner.ts";
export { createContext, provide, inject, type Context } from "./context.ts";
