// Errors the client runtime catches where nothing else would see them (owner: Spark): an island
// whose chunk fails to load or whose hydration throws (TASK-305). One path for all of them, so
// the client instrumentation's `onError` (TASK-299, decision-49) can receive them.

/** Where a reported error happened: `hydrate` covers loading an island's chunk and hydrating it. */
export interface ErrorInfo {
  phase: "hydrate";
  /** The island's ref: its module and export (`/src/Counter.tsx#Counter`). */
  island: string;
}

/** Reports an error the runtime caught. */
export function reportError(error: unknown, info: ErrorInfo): void {
  console.error(`Lumiose: ${info.phase} error in island ${info.island}`, error);
}
