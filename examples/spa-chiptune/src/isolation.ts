// Cross-origin isolation on hosts without COOP/COEP headers (GitHub Pages): register the
// first-party service worker in public/coi-sw.js and reload once, so the page is served with the
// headers. Only the Pages build enables it (LUMIOSE_COI_SW, see vite.config.ts); hosts that send the
// headers are already isolated and skip it. When the worker is unavailable (private windows,
// insecure origins, blocked storage), the page stays as it is and the audio engine falls back to
// postMessage telemetry.

const RELOADED = "chiptune.coi-reload";

export async function isolate(): Promise<void> {
  if (!import.meta.env.LUMIOSE_COI_SW) return;
  if (globalThis.crossOriginIsolated || !window.isSecureContext || !("serviceWorker" in navigator))
    return;
  let reloaded = false;
  try {
    reloaded = sessionStorage.getItem(RELOADED) === "1";
  } catch {
    // Blocked storage: reload at most once anyway, below, by checking the controller.
  }
  try {
    const base = import.meta.env.BASE_URL;
    await navigator.serviceWorker.register(`${base}coi-sw.js`, { scope: base });
    await navigator.serviceWorker.ready;
  } catch {
    return; // No service worker: the non-isolated fallback.
  }
  // Already reloaded once and still not isolated: give up rather than loop.
  if (reloaded) return;
  try {
    sessionStorage.setItem(RELOADED, "1");
  } catch {
    if (navigator.serviceWorker.controller) return;
  }
  location.reload();
}
