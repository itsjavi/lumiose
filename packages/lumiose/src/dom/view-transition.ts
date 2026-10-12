// View transitions (decision-43): `viewTransition(fn)` and `<ViewTransition>`. Opt-in: a module of
// its own, which bundles that use neither leave out (the runtime's size budget does not count it).
// The server variant is ../server/view-transition.ts.
//
// `document.startViewTransition` captures the old state, runs the update, then captures the new
// state. An element named by a `<ViewTransition>` that is in both states moves (the browser morphs
// it); one only in the new state enters, one only in the old state exits. Exits must carry their
// `view-transition-class` when the old state is captured, before the update says which elements
// go: so every connected `<ViewTransition>` with `exit` gets its exit class first, and the ones
// still connected after the update lose it again. Elements connected by the update get their enter
// class until the transition finished.
import type { Renderable } from "../contract/client.ts";
import { flush } from "../core/effect.ts";
import { onCleanup } from "../core/owner.ts";
import { DEV } from "./dev.ts";
import { useId } from "./id.ts";

interface Named {
  el: Element & ElementCSSInlineStyle;
  enter: string | undefined;
  exit: string | undefined;
}

/** The mounted `<ViewTransition>` elements. */
const named = new Set<Named>();

const setClass = (n: Named, value: string): void =>
  n.el.style.setProperty("view-transition-class", value);

/**
 * Runs `fn`, a state update, inside `document.startViewTransition`, flushing so that the DOM shows
 * the new state when the browser captures it. Resolves when the transition finished (rejects when
 * `fn` throws). Without View Transitions support, or when the reader prefers reduced motion, it runs
 * `fn` and flushes at once.
 */
export function viewTransition(fn: () => void): Promise<void> {
  if (
    document.startViewTransition === undefined ||
    matchMedia("(prefers-reduced-motion:reduce)").matches
  ) {
    // Rejects when `fn` throws.
    return new Promise((resolve) => {
      fn();
      flush();
      resolve();
    });
  }
  const before = new Set<Named>();
  for (const n of named) {
    if (n.el.isConnected) {
      before.add(n);
      if (n.exit) setClass(n, n.exit);
    }
  }
  const entered: Named[] = [];
  return document
    .startViewTransition(() => {
      try {
        fn();
        flush();
      } finally {
        for (const n of named) {
          if (before.has(n)) {
            // Still there: a move, not an exit.
            if (n.exit) setClass(n, "");
          } else if (n.enter && n.el.isConnected) {
            setClass(n, n.enter);
            entered.push(n);
          }
        }
      }
    })
    .finished.finally(() => {
      // Unless a later transition gave it its exit class meanwhile.
      for (const n of entered) {
        if (n.el.style.getPropertyValue("view-transition-class") === n.enter) setClass(n, "");
      }
    });
}

export interface ViewTransitionProps {
  /** The child's `view-transition-name`. Default: a `useId()` id, unique in the page. */
  name?: string;
  /** The child's `view-transition-class` while it enters in a `viewTransition()`. */
  enter?: string;
  /** The child's `view-transition-class` while it exits in a `viewTransition()`. */
  exit?: string;
  /** A single element. */
  children?: Renderable;
}

/**
 * Names its single child element for view transitions (`view-transition-name`), so that inside
 * `viewTransition()` it morphs when it moves, and animates when it enters or exits, with the
 * `enter` and `exit` view transition classes.
 */
export function ViewTransition(props: ViewTransitionProps): Renderable {
  const name = props.name ?? useId();
  const child = props.children;
  if (!(child instanceof Element)) {
    if (DEV) {
      console.warn(
        "Lumiose: <ViewTransition> names a single element child; it got something else, which it renders unnamed. Wrap the content in one element.",
      );
    }
    return child;
  }
  const n: Named = { el: child as Named["el"], enter: props.enter, exit: props.exit };
  n.el.style.setProperty("view-transition-name", name);
  named.add(n);
  onCleanup(() => named.delete(n));
  return child;
}
