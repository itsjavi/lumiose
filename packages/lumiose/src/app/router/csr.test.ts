// @vitest-environment happy-dom
// The SPA entry of builds where nothing hydrates (./csr.ts): it finds the shell's root island
// without the island loader and renders the router's root component before its closing marker.
import { afterEach, describe, expect, it } from "vitest";
import type { Component } from "../../contract/client.ts";
import { defineState, signal } from "../../core/index.ts";
import { resetStates } from "../../core/state.ts";
import { insert } from "../../dom/index.ts";
import { startCsr } from "./csr.ts";
import { navigate, url } from "./index.ts";
import { resetRouter, type SpaConfig } from "./router.ts";

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function el(tag: string, text: () => string): HTMLElement {
  const node = document.createElement(tag);
  insert(node, text);
  return node;
}

const APP = "src/routes/layout.tsx";
const Layout: Component<{ children?: unknown }> = (props) => {
  const main = el("main", () => `at ${url().pathname}: `);
  insert(main, () => props.children as never);
  return main;
};
const Home: Component<object> = () => el("h1", () => "home");
const About: Component<object> = () => el("h1", () => "about");
// A scoped state as @lumiose/vite leaves it in a client module (TASK-193).
const viewer = Object.assign(
  defineState(() => ({ name: signal("nobody") })),
  { $$id: "/src/lib/viewer.ts#viewer" },
);
const Me: Component<object> = () => el("h1", () => `me: ${viewer().name()}`);
const NotFound: Component<{ status: number; error: Error }> = (props) =>
  el("h1", () => `${props.status} ${props.error.message}`);

const modules: Record<string, Component<any>> = {
  [APP]: Layout,
  "src/routes/page.tsx": Home,
  "src/routes/about/page.tsx": About,
  "src/routes/me/page.tsx": Me,
  "src/routes/not-found.tsx": NotFound,
};

const config: SpaConfig = {
  base: "/",
  routes: [
    { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
    {
      segments: [{ kind: "static", value: "about" }],
      app: APP,
      levels: [APP, "src/routes/about/page.tsx"],
    },
    {
      segments: [{ kind: "static", value: "me" }],
      app: APP,
      levels: [APP, "src/routes/me/page.tsx"],
    },
  ],
  notFoundPages: [{ file: "src/routes/not-found.tsx", dir: "", segments: [] }],
  pages: { "src/routes/not-found.tsx": { app: APP, levels: [APP, "src/routes/not-found.tsx"] } },
  modules: Object.fromEntries(
    Object.entries(modules).map(([file, component]) => [
      file,
      () => Promise.resolve({ default: component }),
    ]),
  ),
};

/** The body of an `ssr = false` shell: the root island's range and its record. */
function shell(leaf: string, props: object = {}): void {
  const record = { id: 0, ref: `/${leaf}#lumiose:csr`, strategy: "only", props };
  document.body.innerHTML = `<header>site</header><!--l:0--><!--/l:0--><footer>end</footer>`;
  const script = document.createElement("script");
  script.type = "application/json";
  script.dataset.lIslands = "";
  script.textContent = JSON.stringify([record]);
  document.head.append(script);
}

afterEach(() => {
  resetRouter();
  resetStates();
  document.head.innerHTML = document.body.innerHTML = "";
});

describe("startCsr", () => {
  it("renders the SPA root into the shell's range and routes from there", async () => {
    history.replaceState(null, "", "/");
    shell("src/routes/page.tsx");
    startCsr(config);
    await settled();
    expect(document.body.textContent).toBe("siteat /: homeend");
    // The content sits between the markers.
    const end = document.querySelector("footer")!.previousSibling as Comment;
    expect(end.data).toBe("/l:0");
    expect(document.querySelector("main")!.compareDocumentPosition(end)).toBe(4);
    await navigate("/about");
    expect(document.body.textContent).toBe("siteat /about: aboutend");
  });

  it("starts once the client entry ran (decision-49)", async () => {
    history.replaceState(null, "", "/");
    shell("src/routes/page.tsx");
    let done!: () => void;
    startCsr(config, new Promise<void>((resolve) => (done = resolve)));
    await settled();
    expect(document.body.textContent).toBe("siteend");
    done();
    await settled();
    expect(document.body.textContent).toBe("siteat /: homeend");
  });

  it("restores scoped state from the shell's payload before the first render", async () => {
    history.replaceState(null, "", "/me");
    shell("src/routes/me/page.tsx");
    const payload = document.createElement("script");
    payload.type = "application/json";
    payload.dataset.lPayload = "";
    payload.textContent = JSON.stringify({ s: { "/src/lib/viewer.ts#viewer": { name: "ada" } } });
    document.head.prepend(payload);
    startCsr(config);
    await settled();
    expect(document.body.textContent).toBe("siteat /me: me: adaend");
  });

  it("renders the error page the shell names, with its status", async () => {
    history.replaceState(null, "", "/missing");
    shell("src/routes/not-found.tsx", { status: 404, message: "Not Found" });
    startCsr(config);
    await settled();
    expect(document.body.textContent).toBe("siteat /missing: 404 Not Foundend");
  });
});
