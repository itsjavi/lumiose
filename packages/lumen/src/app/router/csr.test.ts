// @vitest-environment happy-dom
// The SPA entry of builds where nothing hydrates (./csr.ts): it finds the shell's root island
// without the island loader and renders the router's root component before its closing marker.
import { afterEach, describe, expect, it } from "vitest";
import type { Component } from "../../contract/client.ts";
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

const APP = "src/routes/_layout.tsx";
const Layout: Component<{ children?: unknown }> = (props) => {
  const main = el("main", () => `at ${url().pathname}: `);
  insert(main, () => props.children as never);
  return main;
};
const Home: Component<object> = () => el("h1", () => "home");
const About: Component<object> = () => el("h1", () => "about");
const NotFound: Component<{ status: number; error: Error }> = (props) =>
  el("h1", () => `${props.status} ${props.error.message}`);

const modules: Record<string, Component<any>> = {
  [APP]: Layout,
  "src/routes/index.tsx": Home,
  "src/routes/about.tsx": About,
  "src/routes/_404.tsx": NotFound,
};

const config: SpaConfig = {
  base: "/",
  routes: [
    { segments: [], app: APP, levels: [APP, "src/routes/index.tsx"] },
    {
      segments: [{ kind: "static", value: "about" }],
      app: APP,
      levels: [APP, "src/routes/about.tsx"],
    },
  ],
  notFoundPages: [{ file: "src/routes/_404.tsx", dir: "", segments: [] }],
  pages: { "src/routes/_404.tsx": { app: APP, levels: [APP, "src/routes/_404.tsx"] } },
  modules: Object.fromEntries(
    Object.entries(modules).map(([file, component]) => [
      file,
      () => Promise.resolve({ default: component }),
    ]),
  ),
};

/** The body of an `ssr = false` shell: the root island's range and its record. */
function shell(leaf: string, props: object = {}): void {
  const record = { id: 0, ref: `/${leaf}#lumen:csr`, strategy: "only", props };
  document.body.innerHTML = `<header>site</header><!--l:0--><!--/l:0--><footer>end</footer>`;
  const script = document.createElement("script");
  script.type = "application/json";
  script.dataset.lIslands = "";
  script.textContent = JSON.stringify([record]);
  document.head.append(script);
}

afterEach(() => {
  resetRouter();
  document.head.innerHTML = document.body.innerHTML = "";
});

describe("startCsr", () => {
  it("renders the SPA root into the shell's range and routes from there", async () => {
    history.replaceState(null, "", "/");
    shell("src/routes/index.tsx");
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

  it("renders the error page the shell names, with its status", async () => {
    history.replaceState(null, "", "/missing");
    shell("src/routes/_404.tsx", { status: 404, message: "Not Found" });
    startCsr(config);
    await settled();
    expect(document.body.textContent).toBe("siteat /missing: 404 Not Foundend");
  });
});
