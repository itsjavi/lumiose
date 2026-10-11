import { onMount } from "solid-js";

declare global {
  interface Window {
    __benchReady?: number;
  }
}

/**
 * Sets `window.__benchReady = performance.now()` once the page has hydrated (doc-4 §4). The root
 * renders it last inside the Suspense boundary around the page, and Solid runs a boundary's
 * effects once its content (the lazily loaded route included) has hydrated.
 */
export function BenchReady() {
  onMount(() => {
    // oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
    window.__benchReady ??= performance.now();
  });
  return null;
}
