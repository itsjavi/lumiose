// `src/instrumentation.client.ts` in the browser (decision-49, TASK-295). Every page the app serves
// loads it as `<script type="module" data-l-client>` in its head, so pages without islands or SPA
// routes run it without the Lumiose runtime. Where islands hydrate or the SPA router starts, the
// generated entries import the same URL again (one module instance) and wait for it: its top-level
// code, top-level `await` included, completes before any island hydrates and before the router
// starts, while the island loader already captures early input. Apps without the file use the
// plain loader and SPA entries, which ship none of this.

import type { IslandManifest } from "../dom/islands.ts";

/**
 * The page's client entry, once its module ran: resolves with its exports, or with `undefined`
 * when it threw (logged: the page hydrates anyway). `undefined` when the page has none.
 */
export function clientEntry(): Promise<unknown> | undefined {
  const script = document.querySelector<HTMLScriptElement>("script[data-l-client]");
  if (script === null) return undefined;
  return import(/* @vite-ignore */ script.src).catch((error: unknown) => {
    console.error("Lumiose: src/instrumentation.client.ts threw; the page hydrates anyway.", error);
  });
}

/** The island manifest with each import waiting for `ready` (the client entry), if any. */
export function afterClientEntry(
  ready: Promise<unknown> | undefined,
): (manifest: IslandManifest) => IslandManifest {
  return (manifest) => {
    if (ready === undefined) return manifest;
    const gated: IslandManifest = {};
    for (const ref in manifest) gated[ref] = () => ready.then(manifest[ref]);
    return gated;
  };
}
