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
import { branch, createRange, renderRange } from "./insert.ts";

export interface SuspenseProps {
  /** Shown while new content below is pending. */
  fallback?: Renderable;
  children?: Renderable;
}

/**
 * Shows `fallback` while new async content below it is pending: the first load, and async
 * components (or resources) that a branch mounts later. Re-runs of revealed content keep their
 * stale UI instead (`pending()` tells them apart). Hidden content stays alive in a fragment.
 * A shown fallback counts for `busy()`.
 */
export function Suspense(props: SuspenseProps): Renderable {
  const count = signal(0);
  provideContext(SUSPENSE, count);
  // Children are created first, so the fallback decision below already sees their first runs.
  const content = renderRange(() => props.children);
  const range = createRange();
  const end = range.$$end;
  branch(
    end.parentNode!,
    end,
    () => count() > 0,
    () => {
      onCleanup(beginBusy());
      return props.fallback;
    },
    () => content,
  );
  return range;
}

export interface ErrorBoundaryProps {
  /** Rendered instead of the children after an error: content, or `(error, retry) => content`. */
  fallback?: Renderable | ((error: unknown, retry: () => void) => Renderable);
  children?: Renderable;
}

/**
 * Renders `fallback` when its children throw while rendering, an effect below throws, or an async
 * component below rejects. `retry()` disposes the fallback and mounts the children again.
 */
export function ErrorBoundary(props: ErrorBoundaryProps): Renderable {
  // `equals: false`: retry after a synchronous failure (which never set it) still re-renders.
  const failure = signal<{ error: unknown } | undefined>(undefined, { equals: false });
  const retry = (): void => failure.set(undefined);
  const capture = (error: unknown): void => failure.set({ error });

  const fallback = (error: unknown): Renderable => {
    const value = props.fallback;
    return renderRange(
      typeof value === "function"
        ? () => (value as (error: unknown, retry: () => void) => Renderable)(error, retry)
        : value,
    );
  };

  const attempt = (): Renderable => {
    const owner = createOwner(getOwner());
    try {
      return runWithOwner(owner, () => {
        onError(capture);
        return renderRange(() => props.children);
      });
    } catch (error) {
      disposeOwner(owner);
      return fallback(error);
    }
  };

  return renderRange(() => {
    const current = failure();
    return untrack(() => (current === undefined ? attempt() : fallback(current.error)));
  });
}
