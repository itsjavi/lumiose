// @vitest-environment happy-dom
// Accessibility of client navigations (TASK-345) on the History API fallback (happy-dom has no
// Navigation API): the route announcer (./announcer.ts) and the fallback's focus reset
// (./history.ts). Components are written in their compiled shape; the SPA boots client-rendered.
// ./announcer-hydration.test.ts covers the announcer of a hydrated SPA root.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { resetStates } from "../../core/state.ts";
import { $async, $await, $leave, createComponent, insert, render } from "../../dom/index.ts";
import { Title } from "../../dom/head.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { afterNavigate, navigate, searchParams } from "./index.ts";
import { createRouter, prepareRoot, resetRouter, type SpaConfig } from "./router.ts";

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function el(tag: string, text?: () => string): HTMLElement {
  const node = document.createElement(tag);
  if (text !== undefined) insert(node, text);
  return node;
}

function title(text: () => string): Renderable {
  return createComponent(Title, {
    get children() {
      return text();
    },
  });
}

/** What happened after each navigation, in order: the scroll, the focus reset and the hooks. */
let log: string[] = [];
let slowGate: { promise: Promise<void>; resolve: () => void };

const APP = "src/routes/layout.tsx";
const Layout: Component<{ children?: Renderable }> = (props) => {
  const main = el("div");
  const link = el("a", () => "About");
  link.setAttribute("href", "/about");
  const box = el("input");
  box.id = "box";
  main.append(link, box);
  insert(main, () => props.children);
  afterNavigate((navigation) => {
    if (navigation.type !== "enter") log.push(`after: ${region()?.textContent}`);
  });
  return main;
};
const Home: Component<object> = () => [title(() => "Home"), el("h1", () => "Welcome")];
const About: Component<object> = () => el("h1", () => " About\n  us ");
const Blank: Component<object> = () => el("p", () => "nothing to see");
const Search: Component<object> = () => [
  title(() => {
    const page = searchParams().get("page");
    return page === null ? "Search" : `Search, page ${page}`;
  }),
  el("h1", () => "Search"),
];
const Form: Component<object> = () => {
  const input = el("input");
  input.id = "query";
  input.setAttribute("autofocus", "");
  return input;
};
const Slow = $async(async function Slow() {
  try {
    (await $await(() => slowGate.promise, 0))();
    return el("h1", () => "Slow");
  } finally {
    $leave();
  }
});

const modules: Record<string, Component<any>> = {
  [APP]: Layout,
  "src/routes/page.tsx": Home,
  "src/routes/about/page.tsx": About,
  "src/routes/blank/page.tsx": Blank,
  "src/routes/search/page.tsx": Search,
  "src/routes/form/page.tsx": Form,
  "src/routes/slow/page.tsx": Slow,
};

const page = (name: string): SpaConfig["routes"][number] => ({
  segments: [{ kind: "static", value: name } satisfies RouteSegment],
  app: APP,
  levels: [APP, `src/routes/${name}/page.tsx`],
});

const config: SpaConfig = {
  base: "/",
  routes: [
    { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
    ...["about", "blank", "search", "form", "slow"].map(page),
  ],
  notFoundPages: [],
  pages: {},
  modules: Object.fromEntries(
    Object.entries(modules).map(([file, component]) => [
      file,
      () => Promise.resolve({ default: component }),
    ]),
  ),
};

let container: HTMLElement;
let dispose: (() => void) | undefined;

async function boot(path: string): Promise<void> {
  history.replaceState(null, "", path);
  createRouter(config, APP);
  const Root = await prepareRoot("src/routes/page.tsx", true);
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => createComponent(Root, {}), container);
  await settled();
}

const content = (): string => container.textContent ?? "";
const region = (): HTMLElement | null => document.querySelector("[data-l-announcer]");

/** What the announcer read since the last call, one entry per change of its region. */
let announcements: string[] = [];
let observer: MutationObserver | undefined;
function listen(): void {
  announcements = [];
  observer = new MutationObserver(() => announcements.push(region()!.textContent ?? ""));
  observer.observe(region()!, { childList: true, characterData: true, subtree: true });
}
async function announced(): Promise<string[]> {
  await settled();
  const read = announcements;
  announcements = [];
  return read;
}

function click(selector: string): void {
  (container.querySelector(selector) as HTMLElement).click();
}

beforeEach(() => {
  log = [];
  let resolve!: () => void;
  slowGate = { promise: new Promise<void>((done) => (resolve = done)), resolve };
  resetStates();
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => log.push("scroll"));
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(document.body, "focus").mockImplementation(function (this: HTMLElement, options) {
    log.push(`focus body (tabindex ${this.getAttribute("tabindex")})`);
    focus.call(this, options);
  });
});

afterEach(() => {
  observer?.disconnect();
  dispose?.();
  dispose = undefined;
  container?.remove();
  resetRouter();
  vi.restoreAllMocks();
});

describe("the route announcer", () => {
  it("is a hidden assertive live region outside the SPA, empty after the first view", async () => {
    await boot("/");
    const live = region()!;
    expect(document.querySelectorAll("[data-l-announcer]")).toHaveLength(1);
    expect(live.parentElement).toBe(document.body);
    expect(container.contains(live)).toBe(false);
    expect(live.getAttribute("aria-live")).toBe("assertive");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(live.style.getPropertyValue("position")).toBe("absolute");
    expect(live.style.getPropertyValue("clip-path")).toBe("inset(50%)");
    expect(live.textContent).toBe("");
  });

  it("reads the new page's title, else its first <h1>, else its path", async () => {
    await boot("/blank");
    listen();
    await navigate("/");
    expect(await announced()).toEqual(["Home"]);
    click("a");
    await settled();
    expect(content()).toContain("About");
    expect(await announced()).toEqual(["About us"]);
    await navigate("/blank");
    expect(await announced()).toEqual(["/blank"]);
    history.back();
    await settled();
    await settled();
    expect(location.pathname).toBe("/about");
    expect(await announced()).toEqual(["About us"]);
  });

  it("does not announce a navigation that keeps the path, unless the title changed", async () => {
    await boot("/search");
    listen();
    await navigate("/search?q=a");
    await searchParams.set({ q: "b" });
    expect(await announced()).toEqual([]);
    await searchParams.set({ q: "b", page: "2" });
    expect(await announced()).toEqual(["Search, page 2"]);
  });

  it("reads the page before the afterNavigate hooks run, after the scroll and focus reset", async () => {
    await boot("/");
    click("a");
    await settled();
    expect(log).toEqual(["scroll", "focus body (tabindex -1)", "after: About us"]);
  });

  it("does not announce a navigation that a newer one supersedes", async () => {
    await boot("/");
    listen();
    const slow = navigate("/slow");
    await navigate("/blank");
    slowGate.resolve();
    await slow;
    expect(await announced()).toEqual(["/blank"]);
  });

  it("goes with the SPA, and the next SPA has its own", async () => {
    await boot("/");
    dispose!();
    dispose = undefined;
    expect(region()).toBeNull();
    resetRouter();
    await boot("/about");
    expect(document.querySelectorAll("[data-l-announcer]")).toHaveLength(1);
  });
});

describe("the History fallback's focus reset", () => {
  it("moves focus to the body, for a moment focusable, after the scroll", async () => {
    await boot("/");
    const link = container.querySelector("a")!;
    link.focus();
    link.click();
    await settled();
    expect(document.activeElement).toBe(document.body);
    expect(document.body.hasAttribute("tabindex")).toBe(false);
    expect(document.body.focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
    expect(log.slice(0, 2)).toEqual(["scroll", "focus body (tabindex -1)"]);
  });

  it("keeps the body's own tabindex", async () => {
    document.body.setAttribute("tabindex", "0");
    try {
      await boot("/");
      await navigate("/about");
      expect(document.body.getAttribute("tabindex")).toBe("0");
    } finally {
      document.body.removeAttribute("tabindex");
    }
  });

  it("focuses the first [autofocus] element instead", async () => {
    await boot("/");
    await navigate("/form");
    expect(document.activeElement?.id).toBe("query");
    expect(document.body.focus).not.toHaveBeenCalled();
  });

  it("keeps focus that moved while the page loaded", async () => {
    await boot("/");
    const shown = navigate("/slow");
    await settled();
    (container.querySelector("#box") as HTMLElement).focus();
    slowGate.resolve();
    await shown;
    expect(content()).toContain("Slow");
    expect(document.activeElement?.id).toBe("box");
    expect(document.body.focus).not.toHaveBeenCalled();
  });

  it("keeps focus and scroll for searchParams.set()", async () => {
    await boot("/search");
    (container.querySelector("#box") as HTMLElement).focus();
    await searchParams.set({ q: "x" });
    expect(location.search).toBe("?q=x");
    expect(document.activeElement?.id).toBe("box");
    expect(log).toEqual(["after: "]);
  });

  it("resets focus on back/forward to another page, not between entries of one page", async () => {
    await boot("/");
    await navigate("/about");
    await navigate("/about#team");
    const box = container.querySelector("#box") as HTMLElement;
    box.focus();
    history.back();
    await settled();
    await settled();
    expect(location.href).toBe(`${location.origin}/about`);
    expect(document.activeElement).toBe(box);
    history.back();
    await settled();
    await settled();
    expect(location.pathname).toBe("/");
    expect(document.activeElement).toBe(document.body);
  });
});
