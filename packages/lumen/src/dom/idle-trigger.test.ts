// @vitest-environment happy-dom
// `client:idle` (TASK-161): the loader asks for an idle callback with a timeout, so an island
// hydrates even when the browser never schedules an idle period (a busy main thread, headless CI).
import { afterEach, describe, expect, it, vi } from "vitest";
import { island, renderToString, ssr } from "../server/index.ts";
import { IDLE_TIMEOUT, loadIslands } from "./islands.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.textContent = "";
});

describe("client:idle", () => {
  it("requests an idle callback with a timeout", async () => {
    const requests: (IdleRequestOptions | undefined)[] = [];
    vi.stubGlobal(
      "requestIdleCallback",
      (_callback: IdleRequestCallback, options?: IdleRequestOptions) => {
        requests.push(options);
        return 1;
      },
    );
    document.body.innerHTML = await renderToString(() =>
      island("/src/case#Idle", () => ssr(["<p>idle</p>"]), {}, "idle"),
    );
    const stop = loadIslands({ "/src/case#Idle": () => Promise.resolve(() => null) });
    await new Promise((done) => setTimeout(done, 0));
    stop();
    expect(requests).toEqual([{ timeout: IDLE_TIMEOUT }]);
    expect(IDLE_TIMEOUT).toBeLessThanOrEqual(2000);
  });
});
