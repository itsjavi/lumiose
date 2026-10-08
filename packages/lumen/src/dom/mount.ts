// `mount(code, container)`: client-renders into a container that becomes an app root, i.e. the
// boundary where delegated event dispatch stops. Used by tests and SPA/benchmark entries until the
// public mounting API is settled (TASK-18 hydrate, TASK-25 SPA).
import type { Renderable } from "../contract/client.ts";
import { createOwner, disposeOwner, runWithOwner } from "../core/internal.ts";
import { clearRegion, createRegion, renderInto } from "./insert.ts";

/** Renders `code()` (tracked) at the end of `container`; returns a disposer that also removes it. */
export function mount(code: () => Renderable, container: Element): () => void {
  const owner = createOwner(undefined);
  const region = createRegion(container, null);
  (container as unknown as Record<string, unknown>).$$root = true;
  runWithOwner(owner, () => renderInto(region, code));
  return () => {
    disposeOwner(owner);
    clearRegion(region);
  };
}
