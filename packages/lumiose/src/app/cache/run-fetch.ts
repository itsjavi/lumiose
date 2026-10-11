// The fetchJSON cache's gate (TASK-233): the only code between fetchJSON and the cache. It reads
// `hasRuns`, which bundles without async components or resources fold to `false`, so the minifier
// empties this function and drops the cache. That folding only works within one chunk, so
// `lumiose build` keeps this module in the runtime chunk with core/effect.ts, while fetchJSON
// itself goes wherever the islands chunking rule puts it. Its arguments are plain values, so a
// folded call leaves nothing behind in the caller.

import { hasRuns } from "../../core/effect.ts";
import { getAbortSignal } from "../../core/owner.ts";
import { cached, inRun, runSignal } from "./client.ts";
import { isCacheable } from "./shared.ts";

/**
 * Called by `fetchJSON()`: inside an async component run (or a resource load), the request for
 * `url` through the cache (or a plain one with the run's signal when `init` opts out); elsewhere,
 * `undefined`, and the caller sends a plain request. `request` sends it with the given init.
 */
export function runFetch<T>(
  url: URL,
  init: RequestInit | undefined,
  request: (init: RequestInit | undefined) => Promise<T>,
): Promise<T> | undefined {
  if (!hasRuns || !inRun()) return;
  // A superseded run stops waiting.
  const signal = init?.signal === undefined ? runSignal() : init.signal;
  if (!isCacheable(init)) return request({ ...init, signal });
  return cached<T>(
    url.href,
    undefined,
    () => request({ ...init, signal: getAbortSignal() }),
    signal,
  );
}
