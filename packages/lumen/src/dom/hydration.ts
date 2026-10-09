// Hydration hook point (contract doc-2 §1, §3.1, spec §7.4; owner: Spark).
//
// Compiled code has a single client path. While an island hydrates, `lumen/dom/hydrate` installs a
// claim cursor here (through the island's frames, ./frame.ts): `template()` factories then claim
// existing nodes instead of cloning, and `insert`, `branch`, `list`, their parentless variants,
// async instances and boundaries adopt the server-rendered nodes of their region before their
// first render. Each helper checks this binding once per call, so bundles that never import
// `lumen/dom/hydrate` pay one `undefined` comparison and contain none of the claiming code.

export interface Hydrator {
  /**
   * Returns the existing node(s) a template instance adopts instead of cloning `content` (the
   * single root, or the container of a multi-root template's roots), or `undefined` to clone.
   */
  template(content: Node, flags: number): Node | Node[] | undefined;
  /**
   * Opens the claim scope of a dynamic region (`insert`, `branch`, `list`) before its first render
   * and returns the server-rendered nodes it adopts; templates rendered inside claim them in order.
   * Reconciliation then keeps the claimed nodes in place and removes the others.
   */
  region(parent: Node, marker: Node | null): Node[];
  /**
   * Whether the server rendered a block whose region `region` would open at `marker`: an
   * `insertText` whose server value was not text (TASK-144).
   */
  block(marker: Node): boolean;
  /** Closes the scope `region` opened, after the region's first render. */
  end(nodes: Node[]): void;
  /** Checks that a branch's adopted region shows the same side (`on`) as the server rendered. */
  branch(nodes: Node[], on: boolean): void;
  /**
   * For a range created by `createRange(mode)`: claims the next server block (`mode` 1, or 2 when
   * a `<!--[!-->` block renders afresh) or the rest of the current region (`mode` 3), moving the
   * range's markers in place. The region later opened on the range's end adopts that content.
   */
  range(start: Node, mode: number): void;
  /**
   * For an async instance: claims its block for the range `start` and returns the adopted nodes
   * plus the cursor its first run claims with, after awaits.
   */
  fork(start: Node): [Node[], Hydrator];
}

export let hydrator: Hydrator | undefined;

/**
 * Thrown to abandon claiming on a mismatch. A handler that catches errors above an island's root
 * (the SPA router's) passes it on to the island, which renders on the client instead.
 */
export const MISMATCH: Error = new Error("LUM4006");

/** Installs (or removes, with `undefined`) the hydration cursor; returns the previous one. */
export function setHydrator(next: Hydrator | undefined): Hydrator | undefined {
  const prev = hydrator;
  hydrator = next;
  return prev;
}
