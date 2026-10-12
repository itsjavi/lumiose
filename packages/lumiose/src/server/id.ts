// `useId()` on the server (decision-43). The browser variant is ../dom/id.ts.
import { renderFrame } from "./frame.ts";

/**
 * An id that is unique in the page and the same in the browser after hydration. Inside an island
 * it is the island's id and the instance path that hydration follows (`l3-0-2-0`); elsewhere, the
 * position in the render's id scopes (`ls0`, `ls2-0`), which does not depend on the order in which
 * async content resolves. Each call takes the next id of the component instance.
 */
export function useId(): string {
  const frame = renderFrame("useId()");
  const n = frame.children++;
  const island = frame.island;
  return island === undefined
    ? `${frame.render.idPrefix}ls${frame.path}${n}`
    : `${frame.render.idPrefix}l${island.id}-${frame.path.replaceAll(".", "-")}-${n}`;
}
