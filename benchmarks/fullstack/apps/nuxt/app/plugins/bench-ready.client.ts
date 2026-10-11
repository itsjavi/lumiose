// The readiness mark of doc-4 §4. Nuxt resolves the root <Suspense> once the app (layout and page
// included) has hydrated, and calls this hook then; later client-side navigations keep the mark.
declare global {
  interface Window {
    __benchReady?: number;
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hooks.hookOnce("app:suspense:resolve", () => {
    // oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
    window.__benchReady ??= performance.now();
  });
});
