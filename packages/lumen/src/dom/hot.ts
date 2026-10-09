// Component-level hot updates in dev (TASK-146). Compiled client modules in `lumen dev` register
// every named component with `$hot` (crates/lumen_compiler/src/hot.rs) and accept their own
// updates through `$hotAccept`. Nothing here runs in production builds: the compiler only emits
// these calls with the `hot` compile option, and `import.meta.hot` is undefined outside dev.
//
// `$hot` returns one stable wrapper per component and module, kept in `import.meta.hot.data`
// across module versions, so parents (in other modules, or the old version of this one) keep
// calling the same function. The wrapper renders the current version of the component as a
// tracked function: when a later module version registers a changed component, each instance
// re-renders in its own region (the region an `insert` gives any component, also under
// hydration), and the rest of the page keeps its DOM and state.

import { onCleanup, signal, untrack, type Signal } from "../core/index.ts";
import { frame } from "./frame.ts";

// oxlint-disable-next-line typescript/no-explicit-any -- any props, as `createComponent` takes.
type Component = (props: any) => unknown;

/** The part of Vite's `import.meta.hot` used here. */
interface HotContext {
  data: Record<string, unknown>;
  invalidate(message?: string): void;
}

interface HotComponent {
  version: string;
  current: Signal<{ fn: Component }>;
  wrapper: Component;
  /** Live instances rendered in place, which cannot re-render (see the wrapper). */
  fixed: number;
}

const WRAPPER = Symbol.for("lumen.hotComponent");

/** Registers a component and returns its stable wrapper (`component` itself without `hot`). */
export function $hot<C extends Component>(
  hot: HotContext | undefined,
  name: string,
  component: C,
  version: string,
): C {
  // Outside `lumen dev` (a build, or a test runner's partial `import.meta.hot`).
  if (hot?.data === undefined) return component;
  const registry = (hot.data["lumenComponents"] ??= new Map()) as Map<string, HotComponent>;
  const known = registry.get(name);
  if (known !== undefined) {
    // A new module version: only a changed component re-renders its instances.
    if (known.version !== version) {
      known.version = version;
      known.current.set({ fn: component });
      if (known.fixed > 0) hot.invalidate(`lumen: ${name} has hydrated instances`);
    }
    return known.wrapper as C;
  }
  const current = signal({ fn: component });
  const entry: HotComponent = { version, current, wrapper: () => null, fixed: 0 };
  const wrapper: Component = (props) => {
    // Hydrating an island (or the SPA): instance paths and the claim order must match the
    // server's, so the instance renders in place, like without the wrapper; a later change to
    // the component then falls back to Vite's update (re-mount or reload).
    if (frame !== undefined) {
      entry.fixed++;
      onCleanup(() => entry.fixed--);
      return entry.current().fn(props);
    }
    return () => {
      const { fn } = current();
      return untrack(() => fn(props));
    };
  };
  entry.wrapper = wrapper;
  Object.defineProperty(wrapper, "name", { value: name });
  (wrapper as Component & { [WRAPPER]?: true })[WRAPPER] = true;
  registry.set(name, entry);
  return wrapper as C;
}

/**
 * Records the module's export names (`next` absent: the module just ran) or checks an update
 * (`next`: the new module's exports). The update stays component-level when the exports keep
 * their names and are all registered components; anything else (a changed export list, an
 * exported constant or signal, `export *` as `null`) invalidates the module, so Vite propagates
 * the update to its importers as before (a re-mount or a reload).
 */
export function $hotAccept(
  hot: HotContext,
  exports: readonly string[] | null,
  next?: Record<string, unknown>,
): void {
  if (hot.data === undefined) return;
  if (next === undefined) {
    hot.data["lumenExports"] ??= exports;
    return;
  }
  const previous = hot.data["lumenExports"] as readonly string[] | null | undefined;
  const same =
    exports !== null &&
    previous != null &&
    previous.length === exports.length &&
    previous.every((name, i) => name === exports[i]) &&
    exports.every((name) => (next[name] as { [WRAPPER]?: true } | undefined)?.[WRAPPER] === true);
  hot.data["lumenExports"] = exports;
  if (!same) hot.invalidate("lumen: the module's exports changed, or are not all components");
}
