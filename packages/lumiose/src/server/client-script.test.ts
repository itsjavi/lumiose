// Client scripts of server-rendered components (./client-script.ts, TASK-354): loaded once per page,
// in the head or in the chunk of the streamed boundary whose components need them.
import { describe, expect, it } from "vitest";
import { clientScript } from "./client-script.ts";
import { Suspense } from "./components.ts";
import { $await, $leave, createComponent, ssr } from "./index.ts";
import { renderShell, type ShellParts } from "./render.ts";

type Props = any;

const tag = (url: string) => `<script type="module" async src="${url}"></script>`;

/** A component that renders `<lu-menu>` and needs its definition. */
function Menu() {
  clientScript("/assets/menu.js", ["/assets/shared.js"]);
  return ssr(["<lu-menu></lu-menu>"]);
}

/** An async component rendering a Menu once `wait` settles. */
async function Later(props: Props) {
  try {
    (await $await(() => props.wait, 0))();
    return createComponent(Menu, {});
  } finally {
    $leave();
  }
}

const menu = () => createComponent(Menu, {});
const later = (wait: Promise<unknown>) => createComponent(Later, { wait });
const suspense = (children: () => unknown) =>
  createComponent(Suspense, {
    get fallback() {
      return ssr(["<p>…</p>"]);
    },
    get children() {
      return children();
    },
  });

async function render(root: () => unknown, resolveAll = false) {
  const parts: ShellParts = await renderShell(root, { resolveAll });
  let stream = "";
  if (parts.stream !== null) for await (const chunk of parts.stream) stream += chunk;
  return { head: parts.head + parts.assets, html: parts.html, stream };
}

describe("clientScript()", () => {
  it("loads the script once from the head, with its imports preloaded", async () => {
    const { head, html } = await render(() => [menu(), menu()]);
    expect(head).toBe(
      `${tag("/assets/menu.js")}<link rel="modulepreload" href="/assets/shared.js">`,
    );
    expect(html).toBe("<lu-menu></lu-menu><lu-menu></lu-menu>");
  });

  it("adds nothing to a page that does not call it", async () => {
    expect((await render(() => ssr(["<p>plain</p>"]))).head).toBe("");
  });

  it("loads it with the streamed boundary that needs it, unless the shell did", async () => {
    const streamed = await render(() => suspense(() => later(Promise.resolve())));
    expect(streamed.head).toBe("");
    expect(streamed.stream.indexOf(tag("/assets/menu.js"))).toBeLessThan(
      streamed.stream.indexOf("<template"),
    );

    const both = await render(() => [menu(), suspense(() => later(Promise.resolve()))]);
    expect(both.head).toContain(tag("/assets/menu.js"));
    expect(both.stream).not.toContain("menu.js");
  });

  it("sends it once when two streamed boundaries need it", async () => {
    const { stream } = await render(() => [
      suspense(() => later(Promise.resolve())),
      suspense(() => later(new Promise((resolve) => setTimeout(resolve, 5)))),
    ]);
    expect(stream.split(tag("/assets/menu.js"))).toHaveLength(2);
  });

  it("moves the boundaries' scripts to the head when prerendering", async () => {
    const { head, stream } = await render(() => suspense(() => later(Promise.resolve())), true);
    expect(head).toContain(tag("/assets/menu.js"));
    expect(stream).toBe("");
  });

  it("does nothing outside a render", () => {
    expect(() => clientScript("/assets/menu.js")).not.toThrow();
  });
});
