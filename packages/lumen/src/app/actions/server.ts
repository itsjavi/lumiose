// Form action helpers under the node condition. `lumen` exposes the same names in both entries,
// so components that render on the server and hydrate (islands) can read them during SSR:
// `actionData()` is the current request's, `submitting()` is false. `submit()` and `invalidate()`
// only make sense in event handlers, so they throw. Keep signatures in sync with ./client.ts.

import type { ActionResult } from "./protocol.ts";
import type { SubmitOptions, SubmitTarget } from "./client.ts";

export { actionData } from "../server/scope.ts";

export function submitting(_name?: string): boolean {
  return false;
}

export function submit<Data = unknown, Failure = unknown>(
  _target: SubmitTarget,
  _options?: SubmitOptions,
): Promise<ActionResult<Data, Failure>> {
  return Promise.reject(browserOnly("submit()"));
}

export function invalidate(): Promise<void> {
  return Promise.reject(browserOnly("invalidate()"));
}

function browserOnly(api: string): Error {
  return new Error(`${api} runs in the browser: call it from an event handler, not during render.`);
}
