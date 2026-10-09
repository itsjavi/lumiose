// The readiness mark of doc-4 §4: `window.__benchReady = performance.now()` once the page's
// interactive parts work. Each island calls it when it mounts (every page has at most one island,
// hydrated with client:load); pages without islands use <ReadyScript /> instead.
declare global {
  interface Window {
    __benchReady?: number;
  }
}

export function markReady(): void {
  // oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
  window.__benchReady ??= performance.now();
}
