// @vitest-environment happy-dom
// The dev HMR wrapper of `lumiose/dom` (`virtual:lumiose/hmr-dom`, ./index.ts) that app entries
// import in `lumiose dev`, run against the real runtime: its `render` replaces the previous root of
// the container and passes render()'s options through, so `useId()` keeps the entry's `idPrefix`
// (TASK-257).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { useId } from "lumiose/internal/dom/id.ts";
import lumiose from "./index.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const dom = resolve(import.meta.dirname, "../../lumiose/src/dom/index.ts");
// The wrapper goes to packages/vite/test/out (ignored), inside the Vite root.
const out = resolve(import.meta.dirname, "../test/out/hmr-dom");
mkdirSync(out, { recursive: true });

type Render = (
  code: () => unknown,
  container: Element,
  options?: { idPrefix?: string },
) => () => void;

/** The wrapper module, as the plugin serves it, importing the runtime from source. */
async function loadWrapper(): Promise<{ render: Render }> {
  const plugin = lumiose().find((p) => p.name === "lumiose")!;
  const load = plugin.load as { handler: (this: unknown, id: string) => Promise<string> };
  const code = await load.handler.call({}, "\0lumiose:hmr-dom");
  const path = join(out, `hmr-dom-${Date.now()}.js`);
  writeFileSync(path, code.replaceAll('from "lumiose/dom"', `from ${JSON.stringify(dom)}`));
  return (await import(/* @vite-ignore */ path)) as { render: Render };
}

function Field(): Element {
  const input = document.createElement("input");
  input.id = useId();
  return input;
}

describe("the dev HMR wrapper of lumiose/dom", () => {
  it("passes render()'s options through, so useId() keeps the idPrefix", async () => {
    const { render } = await loadWrapper();
    const container = document.createElement("main");
    render(Field, container, { idPrefix: "cart-" });
    expect(container.querySelector("input")!.id).toMatch(/^cart-lc\d+$/);

    // A re-run of the entry (a hot update) replaces the root, still with the prefix.
    const dispose = render(Field, container, { idPrefix: "cart-" });
    expect(container.querySelectorAll("input")).toHaveLength(1);
    expect(container.querySelector("input")!.id).toMatch(/^cart-lc\d+$/);
    dispose();
    expect(container.innerHTML).toBe("");

    // Without options, ids have no prefix.
    render(Field, container);
    expect(container.querySelector("input")!.id).toMatch(/^lc\d+$/);
  });
});
