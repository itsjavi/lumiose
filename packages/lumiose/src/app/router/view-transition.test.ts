// @vitest-environment happy-dom
// SPA navigations inside view transitions (TASK-252): with `lumiose({ viewTransitions: true })` the
// SPA entry passes `viewTransition()` in the router's config, and a navigation to another page
// swaps its content inside it. The History API fallback routes here (happy-dom has no Navigation
// API); components are written in their compiled shape.
import { afterEach, describe, expect, it } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { createComponent, insert, render } from "../../dom/index.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { navigate, searchParams } from "./index.ts";
import { createRouter, prepareRoot, resetRouter, type SpaConfig } from "./router.ts";

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const s = (value: string): RouteSegment => ({ kind: "static", value });

function el(tag: string, text: () => string): HTMLElement {
  const node = document.createElement(tag);
  insert(node, text);
  return node;
}

const Root: Component<{ children?: Renderable }> = (props) => {
  const main = document.createElement("main");
  insert(main, () => props.children);
  return main;
};
const Home: Component<object> = () => el("h1", () => "home");
const About: Component<object> = () => el("h1", () => `about ${searchParams().get("q") ?? ""}`);

const APP = "src/routes/layout.tsx";
const modules: Record<string, Component<any>> = {
  [APP]: Root,
  "src/routes/page.tsx": Home,
  "src/routes/about/page.tsx": About,
};

/** What each transition saw: the page text when it started, and after its update. */
let transitions: { start: string; after?: string }[] = [];

function config(): SpaConfig {
  return {
    base: "/",
    routes: [
      { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
      { segments: [s("about")], app: APP, levels: [APP, "src/routes/about/page.tsx"] },
    ],
    notFoundPages: [],
    pages: {},
    modules: Object.fromEntries(
      Object.entries(modules).map(([file, component]) => [
        file,
        () => Promise.resolve({ default: component }),
      ]),
    ),
    // A stand-in for viewTransition(): the update runs in a later task, as the browser's does.
    viewTransition: (update) => {
      const t: { start: string; after?: string } = { start: text() };
      transitions.push(t);
      return new Promise((resolve) =>
        setTimeout(() => {
          update();
          t.after = text();
          resolve();
        }),
      );
    },
  };
}

let container: HTMLElement;
let dispose: (() => void) | undefined;
const text = (): string => container.textContent ?? "";

async function boot(path: string): Promise<void> {
  history.replaceState(null, "", path);
  createRouter(config(), APP);
  const RootComponent = await prepareRoot("src/routes/page.tsx", true);
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => createComponent(RootComponent, {}), container);
  await settled();
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  container?.remove();
  resetRouter();
  transitions = [];
});

describe("SPA navigations with view transitions", () => {
  it("swaps the page inside the transition", async () => {
    await boot("/");
    expect(transitions).toEqual([]);
    await navigate("/about");
    expect(transitions).toEqual([{ start: "home", after: "about " }]);
    await navigate("/");
    expect(transitions[1]).toEqual({ start: "about ", after: "home" });
  });

  it("commits a query change on the same page at once", async () => {
    await boot("/about");
    transitions = [];
    await navigate("/about?q=x");
    expect(text()).toBe("about x");
    expect(transitions).toEqual([]);
  });

  it("drops the swap of a navigation that a newer one superseded meanwhile", async () => {
    await boot("/");
    const first = navigate("/about");
    // The first transition waits for its update; the second navigation supersedes it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = navigate("/");
    await Promise.all([first, second]);
    await settled();
    expect(text()).toBe("home");
  });
});
