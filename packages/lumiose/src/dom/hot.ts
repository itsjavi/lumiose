// Component-level hot updates in dev (TASK-146). Compiled client modules in `lumiose dev` register
// every named component with `$hot` (crates/lumiose_compiler/src/hot.rs) and accept their own
// updates through `$hotAccept`. Nothing here runs in production builds: the compiler only emits
// these calls with the `hot` compile option, and `import.meta.hot` is undefined outside dev.
// With the in-page inspector on (decision-59), `$hot` also passes each component's source location
// and its instances' later renders to the inspector's registry, and `$label` names signals.
//
// `$hot` returns one stable wrapper per component and module, kept in `import.meta.hot.data`
// across module versions, so parents (in other modules, or the old version of this one) keep
// calling the same function. The wrapper renders the current version of the component as a
// tracked function: when a later module version registers a changed component, each instance
// re-renders in its own region (the region an `insert` gives any component, also under
// hydration), and the rest of the page keeps its DOM and state.
//
// Under hydration (islands, the SPA's first page) the wrapper adds no instance: its first render
// runs with the frame `createComponent` gave the instance (its path, await records and claim
// cursor), inside the region `insert` opens for it, so paths, await replay and claiming match the
// server's as without the wrapper.

import { signal, untrack, type Signal } from "../core/index.ts";
import { INSPECTED } from "./dev.ts";
import { currentComponent, labelValue, locateComponent, renderComponent } from "./devtools.ts";
import { frame, setFrame } from "./frame.ts";

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
}

const WRAPPER = Symbol.for("lumiose.hotComponent");

/**
 * Registers a component and returns its stable wrapper (`component` itself without `hot`).
 * `source`: where the component is declared (`src/Counter.stsx:4:17`), for the inspector.
 */
export function $hot<C extends Component>(
  hot: HotContext | undefined,
  name: string,
  component: C,
  version: string,
  source?: string,
): C {
  // Outside `lumiose dev` (a build, or a test runner's partial `import.meta.hot`).
  if (hot?.data === undefined) return component;
  if (INSPECTED && source !== undefined) locateComponent(component, source);
  const registry = (hot.data["lumioseComponents"] ??= new Map()) as Map<string, HotComponent>;
  const known = registry.get(name);
  if (known !== undefined) {
    // A new module version: only a changed component re-renders its instances.
    if (known.version !== version) {
      known.version = version;
      known.current.set({ fn: component });
    }
    if (INSPECTED && source !== undefined) locateComponent(known.wrapper, source);
    return known.wrapper as C;
  }
  const current = signal({ fn: component });
  if (INSPECTED) labelValue(current, "hot update", true);
  const entry: HotComponent = { version, current, wrapper: () => null };
  const wrapper: Component = (props) => {
    // The instance's hydration frame, for its first render only (later ones render afresh).
    let hydrating = frame;
    // The inspector's record of the instance, which `createComponent` just opened.
    const record = INSPECTED ? currentComponent() : undefined;
    return () => {
      const { fn } = current();
      const instanceFrame = hydrating;
      hydrating = undefined;
      const render = (): unknown => {
        if (instanceFrame === undefined) return fn(props);
        const prev = setFrame!(instanceFrame);
        try {
          return fn(props);
        } finally {
          setFrame!(prev);
        }
      };
      return untrack(INSPECTED ? () => renderComponent(record, render) : render);
    };
  };
  entry.wrapper = wrapper;
  Object.defineProperty(wrapper, "name", { value: name });
  if (INSPECTED && source !== undefined) locateComponent(wrapper, source);
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
    hot.data["lumioseExports"] ??= exports;
    return;
  }
  const previous = hot.data["lumioseExports"] as readonly string[] | null | undefined;
  const same =
    exports !== null &&
    previous != null &&
    previous.length === exports.length &&
    previous.every((name, i) => name === exports[i]) &&
    exports.every((name) => (next[name] as { [WRAPPER]?: true } | undefined)?.[WRAPPER] === true);
  hot.data["lumioseExports"] = exports;
  if (!same) hot.invalidate("lumiose: the module's exports changed, or are not all components");
}

/**
 * Names a signal or computed after the variable it is assigned to, for the inspector: the
 * compiler's dev output wraps `const count = signal(0)` as `$label(signal(0), "count")`.
 */
export function $label<T>(value: T, name: string): T {
  if (INSPECTED) labelValue(value, name);
  return value;
}
