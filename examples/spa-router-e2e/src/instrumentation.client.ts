// TASK-299: the client instrumentation, recorded on `window.instrumentation` for the tests. It
// runs before the SPA starts (TASK-295), so the first hydration is observed too.
import type { ClientErrorInfo, ClientInstrumentation } from "lumiose";

const seen = { phases: [] as string[], errors: [] as string[] };
(window as unknown as { instrumentation: typeof seen }).instrumentation = seen;

export function onError(error: unknown, info: ClientErrorInfo): void {
  seen.errors.push(`${info.phase} ${info.route} ${(error as Error).message}`);
}

export const instrumentations: ClientInstrumentation[] = [
  {
    navigate: async (call, info) => {
      const start = performance.now();
      const result = await call();
      const ms = performance.now() - start;
      seen.phases.push(`navigate ${info.type} ${info.to?.route} ${result.status} ${ms >= 0}`);
    },
    hydrate: async (call, info) => {
      const result = await call();
      seen.phases.push(`hydrate ${info.island.split("#")[1]} ${result.status}`);
    },
    fetch: async (call, info) => {
      const result = await call();
      seen.phases.push(
        `fetch ${"url" in info ? new URL(info.url).pathname : info.key} ${result.status}`,
      );
    },
  },
];
