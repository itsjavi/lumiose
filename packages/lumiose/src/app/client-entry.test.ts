// @vitest-environment happy-dom
// `src/instrumentation.client.ts` in the browser (decision-49, TASK-295): the page's
// `<script data-l-client>` runs once, and islands and the SPA wait for it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadIslands, type IslandManifest } from "../dom/islands.ts";
import { afterClientEntry, clientEntry } from "./client-entry.ts";

vi.mock("../dom/islands.ts", async (original) => {
  const actual = await original<typeof import("../dom/islands.ts")>();
  return { ...actual, loadIslands: vi.fn(actual.loadIslands) };
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A `<script type="module" data-l-client>` whose module is `code`. */
function clientScript(code: string): void {
  const script = document.createElement("script");
  script.dataset.lClient = "";
  // Not `type="module"`: happy-dom would run it; the browser runs the real one.
  script.type = "text/plain";
  script.src = `data:text/javascript,${encodeURIComponent(code)}`;
  document.head.append(script);
}

afterEach(() => {
  document.head.innerHTML = document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("clientEntry()", () => {
  it("is undefined on a page without a client entry", () => {
    expect(clientEntry()).toBeUndefined();
  });

  it("resolves with the module's exports once its top-level await completed", async () => {
    clientScript(
      "await new Promise((resolve) => setTimeout(resolve, 5)); export const onError = 1;",
    );
    expect(await clientEntry()).toMatchObject({ onError: 1 });
  });

  it("logs what the module throws and resolves anyway", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    clientScript("throw new Error('sdk failed');");
    expect(await clientEntry()).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "Lumiose: src/instrumentation.client.ts threw; the page hydrates anyway.",
      expect.objectContaining({ message: "sdk failed" }),
    );
  });
});

describe("afterClientEntry()", () => {
  it("leaves the manifest alone without a client entry", () => {
    const manifest: IslandManifest = { "/src/A.tsx#A": () => Promise.resolve() };
    expect(afterClientEntry(undefined)(manifest)).toBe(manifest);
  });

  it("holds every import until the client entry ran", async () => {
    let done!: () => void;
    const ready = new Promise<void>((resolve) => (done = resolve));
    const load = vi.fn(() => Promise.resolve("component"));
    const gated = afterClientEntry(ready)({ "/src/A.tsx#A": load });
    const imported = gated["/src/A.tsx#A"]!();
    await settle();
    expect(load).not.toHaveBeenCalled();
    done();
    expect(await imported).toBe("component");
    expect(load).toHaveBeenCalledOnce();
  });

  it("lets the island loader capture input while islands wait for it", async () => {
    document.body.innerHTML = `<!--l:0--><button>buy</button><!--/l:0-->`;
    const records = document.createElement("script");
    records.type = "application/json";
    records.dataset.lIslands = "";
    records.textContent = JSON.stringify([
      { id: 0, ref: "/src/Buy.tsx#Buy", strategy: "visible", props: {} },
    ]);
    document.body.append(records);
    let done!: () => void;
    const ready = new Promise<void>((resolve) => (done = resolve));
    const load = vi.fn(() => new Promise<never>(() => {}));
    loadIslands(afterClientEntry(ready)({ "/src/Buy.tsx#Buy": load }));
    // A click before the client entry ran: held back, and the island's import waits.
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("button")!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    await settle();
    expect(load).not.toHaveBeenCalled();
    done();
    await settle();
    expect(load).toHaveBeenCalledOnce();
  });
});

describe("startSpa() with a client entry", () => {
  it("gates the island manifest, the SPA roots included", async () => {
    const { startSpa } = await import("./router/boot.ts");
    const gate = vi.fn((manifest: IslandManifest) => manifest);
    startSpa(
      { "/src/A.tsx#A": () => Promise.resolve() },
      {
        base: "/",
        routes: [
          {
            segments: [],
            app: "src/routes/layout.tsx",
            levels: ["src/routes/layout.tsx", "src/routes/page.tsx"],
          },
        ],
        notFoundPages: [],
        pages: {},
        modules: {},
      },
      gate,
    );
    expect(Object.keys(gate.mock.calls[0]![0]).toSorted()).toEqual([
      "/src/A.tsx#A",
      "/src/routes/page.tsx#lumiose:csr",
      "/src/routes/page.tsx#lumiose:spa",
    ]);
    expect(vi.mocked(loadIslands)).toHaveBeenLastCalledWith(gate.mock.results[0]!.value);
  });
});
