import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from "remix/multiple-import-maps-polyfill";
import { run } from "remix/component";

declare global {
  interface Window {
    __benchReady?: number;
  }
}

const app = run({
  async loadModule(moduleUrl, exportName) {
    const mod = await importModule(moduleUrl);
    const Component = mod[exportName];
    if (typeof Component !== "function") {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
    }
    return Component;
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads;
    preloadShim(preloads);
    return [];
  },
});

app.addEventListener("error", (event) => {
  console.error("Component error:", event.error);
});

// Development (`hmr.ts`): reload the page's HTML when the server restarts with new code.
if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error("Error reloading top frame on server update", error);
    }
  });
}

// The readiness mark of doc-4 §4: the page's client entries have hydrated and the runtime
// intercepts links and forms.
await app.ready();
// oxlint-disable-next-line no-underscore-dangle -- the name is fixed by doc-4 §4
window.__benchReady ??= performance.now();
