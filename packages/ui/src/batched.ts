// The components' native listeners (`on:`) run inside `batch()`, as Lumiose's delegated event
// handlers do (TASK-540): the signal writes of a listener and of the callbacks it calls
// (`onValueChange`, `onOpenChange`, …) render together, before the event's dispatch returns, so
// the DOM is current right after it instead of a microtask later.
import { batch } from "lumiose";

/** `listener`, run inside `batch()`. */
export const batched =
  <E>(listener: (event: E) => void) =>
  (event: E): void =>
    batch(() => listener(event));
