// @vitest-environment happy-dom
// Accessibility of client navigations (TASK-345) on the History API fallback (happy-dom has no
// Navigation API): the route announcer (./announcer.ts), the fallback's focus reset (./history.ts)
// and its fragment navigations, left to the browser (TASK-350). Components are written in their
// compiled shape; the SPA boots client-rendered.
// ./announcer-hydration.test.ts covers the announcer of a hydrated SPA root.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { resetStates } from "../../core/state.ts";
import { $async, $await, $leave, createComponent, insert, render } from "../../dom/index.ts";
import { Title } from "../../dom/head.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { afterNavigate, navigate, searchParams, url } from "./index.ts";
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

/**
 * A browser's fragment navigation, as Chromium runs it (happy-dom fires no `popstate` for one): it
 * adds or replaces the entry with a null state, fires `popstate`, then scrolls to the fragment.
 */
function fragmentNavigation(href: string, replace: boolean): void {
  if (replace) history.replaceState(null, "", href);
  else history.pushState(null, "", href);
  dispatchEvent(new PopStateEvent("popstate", { state: null }));
  log.push(`browser scrolls to ${location.hash}`);
}

/** A link click that nothing prevented, as browsers run it for a fragment of the page. */
function browserClick(event: MouseEvent): void {
  const link = (event.target as Element).closest("a");
  if (event.defaultPrevented || link === null) return;
  const to = new URL(link.href);
  if (to.pathname === location.pathname && to.search === location.search && to.href.includes("#")) {
    event.preventDefault();
    fragmentNavigation(to.href, to.href === location.href);
  }
}

let stopFragments: (() => void) | undefined;
/**
 * Fragment navigations as browsers run them, for `location.assign()`/`replace()` and links that
 * nothing prevented. After `boot()`: the click listener runs after the router's.
 */
function browserFragments(): void {
  vi.spyOn(location, "assign").mockImplementation((href) =>
    fragmentNavigation(String(href), false),
  );
  vi.spyOn(location, "replace").mockImplementation((href) =>
    fragmentNavigation(String(href), true),
  );
  addEventListener("click", browserClick);
  stopFragments = () => removeEventListener("click", browserClick);
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
  stopFragments?.();
  stopFragments = undefined;
  vi.unstubAllGlobals();
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
    browserFragments();
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

describe("fragment navigations in the History fallback", () => {
  // At the end of the session history, so that the browser's entries grow `history.length`.
  beforeEach(() => history.pushState(null, "", "/"));

  it("leaves navigate() to a fragment of the page to the browser, and follows its URL", async () => {
    await boot("/about");
    browserFragments();
    listen();
    log = [];
    const box = container.querySelector("#box") as HTMLElement;
    box.focus();
    await navigate("/about#team");
    expect(location.assign).toHaveBeenCalledWith(`${location.origin}/about#team`);
    expect(url().hash).toBe("#team");
    // No scroll of the router's, focus reset, hooks or announcement.
    expect(log).toEqual(["browser scrolls to #team"]);
    expect(document.activeElement).toBe(box);
    expect(await announced()).toEqual([]);
    // The entry the browser added gets a key and the next index.
    expect(history.state).toEqual({ "lumiose:key": expect.any(String), "lumiose:index": 1 });
  });

  it("replaces the entry for navigate(…, { replace: true })", async () => {
    await boot("/about");
    browserFragments();
    await navigate("/about#team", { replace: true });
    expect(location.replace).toHaveBeenCalledWith(`${location.origin}/about#team`);
    expect(location.assign).not.toHaveBeenCalled();
    expect(url().hash).toBe("#team");
    expect(history.state).toEqual({ "lumiose:key": expect.any(String), "lumiose:index": 0 });
  });

  it("leaves links to a fragment of the page to the browser, the current one included", async () => {
    await boot("/about");
    browserFragments();
    log = [];
    const link = el("a");
    link.setAttribute("href", "#team");
    container.append(link);
    link.click();
    await settled();
    // The same URL again: the browser replaces the entry.
    link.click();
    await settled();
    expect(location.href).toBe(`${location.origin}/about#team`);
    expect(url().hash).toBe("#team");
    expect(log).toEqual(["browser scrolls to #team", "browser scrolls to #team"]);
    expect((history.state as Record<string, unknown>)["lumiose:index"]).toBe(1);
  });

  it("restores the scroll position of an entry the browser added on back/forward", async () => {
    await boot("/about");
    browserFragments();
    log = [];
    const link = el("a");
    link.setAttribute("href", "#team");
    container.append(link);
    link.click();
    await settled();
    // The router does not scroll back to the top after the browser.
    expect(log).toEqual(["browser scrolls to #team"]);
    // Where the browser scrolled to, and the user left it.
    vi.stubGlobal("scrollY", 300);
    await navigate("/blank");
    vi.stubGlobal("scrollY", 0);
    history.back();
    await settled();
    await settled();
    expect(location.hash).toBe("#team");
    expect(scrollTo).toHaveBeenLastCalledWith(0, 300);
  });

  it("leaves the index of an entry it cannot place unknown", async () => {
    await boot("/about");
    browserFragments();
    // Not through navigate(): nothing tells the router that the browser replaced the entry.
    location.replace(`${location.origin}/about#team`);
    await settled();
    expect(url().hash).toBe("#team");
    expect(history.state).toEqual({
      "lumiose:key": expect.any(String),
      "lumiose:index": undefined,
    });
  });
});
