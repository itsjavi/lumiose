// Hydration hook point (contract doc-2 §1, spec §7.4; owner: Spark).
//
// Compiled code has a single client path. `lumen/dom/hydrate` (TASK-18) installs a claim cursor
// here; while it is set, `template()` factories claim existing nodes instead of cloning, and the
// `insert`, `branch` and `list` helpers adopt the server-rendered nodes of their region before their
// first render. Each helper checks this binding once per call, so bundles that never import
// `lumen/dom/hydrate` pay one `undefined` comparison and contain none of the claiming code.

export interface Hydrator {
  /**
   * Returns the existing node(s) a template instance adopts instead of cloning `content`: the
   * single root node, or the container of a multi-root template's roots (`TemplateFlags`).
   */
  template(content: Node, flags: number): Node | Node[];
  /**
   * Returns the server-rendered nodes of a dynamic region (`insert`, `branch`, `list`) before its
   * first render, and positions the cursor so the region's templates claim them in order.
   * Reconciliation then keeps the claimed nodes in place and removes the others (mismatches).
   */
  region(parent: Node, marker: Node | null): Node[];
}

export let hydrator: Hydrator | undefined;

/** Installs (or removes, with `undefined`) the hydration cursor; returns the previous one. */
export function setHydrator(next: Hydrator | undefined): Hydrator | undefined {
  const prev = hydrator;
  hydrator = next;
  return prev;
}
