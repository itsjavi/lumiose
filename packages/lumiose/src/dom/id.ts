// `useId()` in the browser (decision-43). The server variant is ../server/id.ts.
import { readContext } from "../core/owner.ts";
import { frame } from "./frame.ts";

/** Context key of a root's id prefix: `render(…, { idPrefix })`, or an island's record. */
export const ID_PREFIX: unique symbol = Symbol();

let count = 0;

/**
 * An id that is unique in the page. While an island hydrates, it is the server's id (the island's
 * id and the instance path, ./frame.ts); content rendered in the browser only gets `lc<n>` from a
 * counter. Each call takes the next id of the component instance.
 */
export function useId(): string {
  const f = frame;
  return f === undefined
    ? `${readContext(ID_PREFIX, "") as string}lc${count++}`
    : `${f.i}-${f.path.replaceAll(".", "-")}-${f.children++}`;
}
