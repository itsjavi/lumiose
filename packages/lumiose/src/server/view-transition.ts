// Server variants of the view transition APIs (decision-43); the browser ones are
// ../dom/view-transition.ts. Nothing animates on the server: the browser names the element when it
// hydrates it.
import type { ViewTransitionProps } from "../dom/view-transition.ts";
import { useId } from "./id.ts";

export type { ViewTransitionProps } from "../dom/view-transition.ts";

/** Runs `fn`: there is no transition on the server. */
export function viewTransition(fn: () => void): Promise<void> {
  try {
    fn();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Renders its child as is. It takes the default name's `useId()` as the browser does, so the ids
 * after it still match when an island hydrates.
 */
export function ViewTransition(props: ViewTransitionProps): unknown {
  if (props.name === undefined) useId();
  return props.children;
}
