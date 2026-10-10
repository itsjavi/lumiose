// Cross-origin isolation for hosts that cannot send headers (GitHub Pages). The page registers this
// service worker only in the Pages build and only when it is not already isolated; it re-serves
// every same-origin response with COOP/COEP (and CORP), which makes the next load of the page
// cross-origin isolated, so the audio engine can share memory with the UI (SharedArrayBuffer).
// Hosts that send the headers themselves (lumiose dev, lumiose preview, _headers) never install it.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Only this origin: cross-origin requests go out untouched.
  if (new URL(request.url).origin !== self.location.origin) return;
  // A quirk of some browsers: this combination throws when re-fetched.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set("cross-origin-opener-policy", "same-origin");
      headers.set("cross-origin-embedder-policy", "require-corp");
      headers.set("cross-origin-resource-policy", "same-origin");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
