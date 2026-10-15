// Client boundaries (decision-13, spec §4.4, §6.3): `<Suspense>` and `<ErrorBoundary>`.
// Both render into ranges of their own, so the regions they sit in never re-run when they switch.
import type { Renderable } from "../contract/client.ts";
import {
  beginBusy,
  createOwner,
  disposeOwner,
  getOwner,
  onError,
  onCleanup,
  provideContext,
  runWithOwner,
  SUSPENSE,
} from "../core/internal.ts";
import { untrack } from "../core/reactive.ts";
import { signal } from "../core/signal.ts";
import { hydrator } from "./hydration.ts";
import { branch, createRange, renderRange } from "./insert.ts";
import { INSTRUMENTED, notify } from "./instrument.ts";
import { INSPECTED } from "./dev.ts";
import { labelValue } from "./devtools.ts";

export interface SuspenseProps {
  /** Shown while new content below is pending. */
  fallback?: Renderable;
  children?: Renderable;
}

/**
 * Shows `fallback` while new async content below it is pending: the first load, and async
 * components (or resources) that a branch mounts later. Re-runs of revealed content keep their
 * stale UI instead (`isPending()` tells them apart). Hidden content stays alive in a fragment.
 * A shown fallback counts for `isBusy()`.
 */
export function Suspense(props: SuspenseProps): Renderable {
  const count = signal(0);
  if (import.meta.env?.DEV && INSPECTED) labelValue(count, "Suspense pending", true);
  provideContext(SUSPENSE, count);
  // Under hydration the range claims the server block and the content adopts what is inside;
  // the server content then stays while the first runs replay, instead of the fallback.
  let hydrating = hydrator !== undefined;
  const range = createRange(1);
  const end = range.$$end;
  // Children are created first, so the fallback decision below already sees their first runs.
  const content = renderRange(() => props.children, 3);
  // The condition is "show the content", the side a server `<!--[-->` block shows.
  branch(
    end.parentNode!,
    end,
    () => {
      const pending = count() > 0;
      if (!pending) {
        hydrating = false;
      }
      return !pending || hydrating;
    },
    () => content,
    () => {
      onCleanup(beginBusy());
      return props.fallback;
    },
  );
  return range;
}

export interface ErrorBoundaryProps {
  /** Rendered instead of the children after an error: content, or `(error, reset) => content`. */
  fallback?: Renderable | ((error: unknown, reset: () => void) => Renderable);
  children?: Renderable;
}

/**
 * Renders `fallback` when its children throw while rendering, an effect below throws, or an async
 * component below rejects. `reset()` disposes the fallback and renders the children again.
 */
export function ErrorBoundary(props: ErrorBoundaryProps): Renderable {
  // `equals: false`: a reset after a synchronous failure (which never set it) still re-renders.
  const failure = signal<{ error: unknown } | undefined>(undefined, { equals: false });
  if (import.meta.env?.DEV && INSPECTED) labelValue(failure, "ErrorBoundary error", true);
  const reset = (): void => failure.set(undefined);
  const capture = (error: unknown): void => failure.set({ error });

  const fallback = (error: unknown): Renderable => {
    const value = props.fallback;
    return renderRange(
      typeof value === "function"
        ? () => (value as (error: unknown, reset: () => void) => Renderable)(error, reset)
        : value,
    );
  };

  const attempt = (): Renderable => {
    const owner = createOwner(getOwner());
    try {
      return runWithOwner(owner, () => {
        // Instrumented builds tell `onError` of src/instrumentation.client.ts (./instrument.ts).
        onError(
          INSTRUMENTED
            ? (error) => {
                notify(error, "render", owner);
                capture(error);
              }
            : capture,
        );
        return renderRange(() => props.children, 3);
      });
    } catch (error) {
      if (INSTRUMENTED) notify(error, "render", owner);
      disposeOwner(owner);
      return fallback(error);
    }
  };

  // Under hydration: the server block holds the children, or a fallback (`<!--[!-->`), in which
  // case the children render afresh.
  return renderRange(() => {
    const current = failure();
    return untrack(() => (current === undefined ? attempt() : fallback(current.error)));
  }, 2);
}
