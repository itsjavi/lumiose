// Errors the client runtime catches where nothing else would see them (owner: Spark): an island
// whose chunk fails to load or whose hydration throws (TASK-305). They are logged, and with
// `src/instrumentation.client.ts` they also reach its `onError` (TASK-299, ./instrument.ts).
import { INSTRUMENTED, notify } from "./instrument.ts";

/** Where a reported error happened: `hydrate` covers loading an island's chunk and hydrating it. */
export interface ErrorInfo {
  phase: "hydrate";
  /** The island's ref: its module and export (`/src/Counter.tsx#Counter`). */
  island: string;
}

/** Reports an error the runtime caught: logged, then sent to `onError` when instrumented. */
export function reportError(error: unknown, info: ErrorInfo): void {
  console.error(`Lumiose: ${info.phase} error in island ${info.island}`, error);
  if (INSTRUMENTED) notify(error, info.phase, info.island);
}
