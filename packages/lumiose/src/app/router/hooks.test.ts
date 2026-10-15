// @vitest-environment happy-dom
// `beforeNavigate` and `afterNavigate` (decision-50, TASK-296): on the History API fallback
// (happy-dom has no Navigation API), on a stand-in for the Navigation API, and in a component
// outside any SPA (an island on an MPA page). Components are written in their compiled shape.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { createComponent, insert, render } from "../../dom/index.ts";
import type { RouteSegment } from "../routes/segments.ts";
import {
  afterNavigate,
  beforeNavigate,
  navigate,
  searchParams,
  type AfterNavigate,
  type BeforeNavigate,
} from "./index.ts";
import { createRouter, prepareRoot, resetRouter, type SpaConfig } from "./router.ts";

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const s = (value: string): RouteSegment => ({ kind: "static", value });
const param = (name: string): RouteSegment => ({ kind: "param", name });

function el(tag: string, text?: () => string): HTMLElement {
  const node = document.createElement(tag);
  if (text !== undefined) insert(node, text);
  return node;
}

const path = (url: URL): string => url.pathname + url.search;
/** A navigation as `type from -> to`, plus `(unload)`. */
function line(n: BeforeNavigate | AfterNavigate): string {
  const from = n.from === null ? "null" : path(n.from.url);
  const to = n.to === null ? "null" : path(n.to.url);
  return `${n.type} ${from} -> ${to}${n.willUnload ? " (unload)" : ""}`;
}

/** What the layout's hooks saw; `cancel` decides whether its `beforeNavigate` cancels. */
let log: string[] = [];
let seen: (BeforeNavigate | AfterNavigate)[] = [];
let cancel: (n: BeforeNavigate) => boolean = () => false;
/** The page text when the layout's `afterNavigate` ran. */
let textAtAfter: string[] = [];

const Root: Component<{ children?: Renderable }> = (props) => {
  beforeNavigate((n) => {
    log.push(`before ${line(n)}`);
    seen.push(n);
    if (cancel(n)) n.cancel();
  });
  afterNavigate((n) => {
    log.push(`after ${line(n)}`);
    seen.push(n);
    textAtAfter.push(text());
  });
  const main = el("main");
  insert(main, () => props.children);
  return main;
};
const Home: Component<object> = () => el("h1", () => "home");
// A page with hooks of its own: removed when it goes, and first called by the navigation that
// created it.
const About: Component<object> = () => {
  beforeNavigate((n) => log.push(`about before ${line(n)}`));
  afterNavigate((n) => log.push(`about after ${line(n)}`));
  return el("h1", () => "about");
};
const Search: Component<object> = () => el("p", () => `q=${searchParams().get("q") ?? ""}`);
const User: Component<{ params: { id: string } }> = (props) =>
  el("h1", () => `user ${props.params.id}`);

const APP = "src/routes/layout.tsx";
const modules: Record<string, Component<any>> = {
  [APP]: Root,
  "src/routes/page.tsx": Home,
  "src/routes/about/page.tsx": About,
  "src/routes/search/page.tsx": Search,
  "src/routes/users/[id]/page.tsx": User,
};

let transitions = 0;
function config(viewTransitions = false): SpaConfig {
  return {
    base: "/",
    routes: [
      { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
      { segments: [s("about")], app: APP, levels: [APP, "src/routes/about/page.tsx"] },
      { segments: [s("search")], app: APP, levels: [APP, "src/routes/search/page.tsx"] },
      {
        segments: [s("users"), param("id")],
        app: APP,
        levels: [APP, "src/routes/users/[id]/page.tsx"],
      },
      // A page outside the SPA.
      { segments: [s("static")] },
    ],
    notFoundPages: [],
    pages: {},
    modules: Object.fromEntries(
      Object.entries(modules).map(([file, component]) => [
        file,
        () => Promise.resolve({ default: component }),
      ]),
    ),
    ...(viewTransitions
      ? {
          // A stand-in for viewTransition(): the update runs in a later task, as the browser's does.
          viewTransition: (update: () => void) => {
            transitions++;
            return new Promise<void>((resolve) =>
              setTimeout(() => {
                update();
                resolve();
              }),
            );
          },
        }
      : {}),
  };
}

let container: HTMLElement;
let dispose: (() => void) | undefined;
const text = (): string => container?.textContent ?? "";

async function boot(at: string, viewTransitions = false): Promise<void> {
  history.replaceState(null, "", at);
  createRouter(config(viewTransitions), APP);
  const RootComponent = await prepareRoot("src/routes/page.tsx", true);
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => createComponent(RootComponent, {}), container);
  // The History API fallback is a chunk of its own: clicks before it loads are not intercepted.
  await import("./history.ts");
  await settled();
}

function click(href: string): void {
  const link = document.createElement("a");
  link.href = href;
  container.append(link);
  link.click();
  link.remove();
}

/** A `beforeunload` the browser fires when the document is about to unload; true when it asks. */
function unload(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  log = [];
  seen = [];
  textAtAfter = [];
  transitions = 0;
  cancel = () => false;
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  container?.remove();
  resetRouter();
  vi.unstubAllGlobals();
});

describe("router hooks on the History API fallback", () => {
  it("fires afterNavigate once with enter when the component mounts", async () => {
    await boot("/users/1");
    expect(log).toEqual(["after enter null -> /users/1"]);
    expect(seen[0]!.to).toEqual({
      url: new URL(`${location.origin}/users/1`),
      route: "/users/[id]",
      params: { id: "1" },
    });
  });

  it("runs both hooks around link clicks, with the previous and new locations", async () => {
    await boot("/");
    log = [];
    seen = [];
    click("/users/2");
    await settled();
    expect(text()).toBe("user 2");
    expect(log).toEqual(["before link / -> /users/2", "after link / -> /users/2"]);
    const [before, after] = seen as [BeforeNavigate, AfterNavigate];
    expect(before.from).toEqual({ url: new URL(`${location.origin}/`), route: "/", params: {} });
    expect(before.to).toEqual({
      url: new URL(`${location.origin}/users/2`),
      route: "/users/[id]",
      params: { id: "2" },
    });
    expect(after.to).toEqual(before.to);
    // After the swap, the scroll and the focus reset.
    expect(textAtAfter).toEqual(["home", "user 2"]);
  });

  it("cancels link clicks and navigate(), keeping the URL", async () => {
    await boot("/");
    log = [];
    cancel = () => true;
    click("/users/2");
    await settled();
    await navigate("/about");
    expect(location.pathname).toBe("/");
    expect(text()).toBe("home");
    expect(log).toEqual(["before link / -> /users/2", "before navigate / -> /about"]);
  });

  it("runs navigate() and searchParams.set() as navigate, query-only changes included", async () => {
    await boot("/search?q=a");
    log = [];
    await searchParams.set({ q: "b" });
    expect(text()).toBe("q=b");
    click("/search?q=c");
    await settled();
    expect(text()).toBe("q=c");
    await navigate("/");
    expect(log).toEqual([
      "before navigate /search?q=a -> /search?q=b",
      "after navigate /search?q=a -> /search?q=b",
      "before link /search?q=b -> /search?q=c",
      "after link /search?q=b -> /search?q=c",
      "before navigate /search?q=c -> /",
      "after navigate /search?q=c -> /",
    ]);
    cancel = () => true;
    await searchParams.set({ q: "x" });
    expect(location.search).toBe("");
  });

  it("returns to the entry a cancelled back/forward left", async () => {
    await boot("/");
    await navigate("/users/1");
    await navigate("/users/2");
    log = [];
    cancel = (n) => n.type === "popstate";
    history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(location.pathname).toBe("/users/2");
    expect(text()).toBe("user 2");
    expect(log).toEqual(["before popstate /users/2 -> /users/1"]);
    cancel = () => false;
    history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(location.pathname).toBe("/users/1");
    expect(text()).toBe("user 1");
    expect(log.slice(1)).toEqual([
      "before popstate /users/2 -> /users/1",
      "after popstate /users/2 -> /users/1",
    ]);
  });

  it("removes a component's hooks when it is disposed; a page created by a navigation gets its after call, not enter", async () => {
    await boot("/");
    log = [];
    await navigate("/about");
    expect(log).toEqual([
      "before navigate / -> /about",
      "after navigate / -> /about",
      "about after navigate / -> /about",
    ]);
    log = [];
    await navigate("/");
    await navigate("/search");
    expect(log).toEqual([
      "before navigate /about -> /",
      "about before navigate /about -> /",
      "after navigate /about -> /",
      "before navigate / -> /search",
      "after navigate / -> /search",
    ]);
  });

  it("runs afterNavigate after a view transition's DOM update", async () => {
    await boot("/", true);
    textAtAfter = [];
    await navigate("/about");
    expect(transitions).toBe(1);
    expect(textAtAfter).toEqual(["about"]);
  });

  it("runs the hooks of navigations to other documents with willUnload; a cancel makes the browser ask", async () => {
    await boot("/");
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...location,
      href: location.href,
      origin: location.origin,
      assign,
    });
    log = [];
    seen = [];
    await navigate("/static");
    expect(assign).toHaveBeenCalledWith(`${location.origin}/static`);
    expect(log).toEqual(["before navigate / -> /static (unload)"]);
    expect(seen[0]!.to?.route).toBe("/static");
    // The hooks ran already: `beforeunload` does not run them again as leave.
    expect(unload()).toBe(false);
    expect(log).toHaveLength(1);
    cancel = () => true;
    await navigate("https://example.com/away");
    expect(log[1]).toBe("before navigate / -> null (unload)");
    expect(unload()).toBe(true);
    // Closing the tab: leave.
    expect(unload()).toBe(true);
    expect(log[2]).toBe("before leave / -> null (unload)");
  });
});

/** A stand-in for the Navigation API (`navigation`): enough of it for the router. */
class FakeNavigation extends EventTarget {
  entries: { key: string; url: string }[] = [];
  index = 0;
  transition: { finished: Promise<void> } | null = null;
  /** URLs of navigations it let the document make (not intercepted). */
  documents: string[] = [];
  #abort: ((error: unknown) => void) | undefined;
  #keys = 0;

  constructor() {
    super();
    this.entries.push({ key: this.#key(), url: location.href });
  }

  get currentEntry(): { key: string; url: string } {
    return this.entries[this.index]!;
  }

  navigate(url: string, options: { history?: string; info?: unknown } = {}) {
    const target = new URL(url, location.href).href;
    return this.#fire(
      target,
      options.history === "replace" ? "replace" : "push",
      options.info,
      true,
    );
  }

  /** A link click (no info) or a script navigation. */
  click(url: string) {
    return this.navigate(url);
  }

  /** Back/forward by `delta`; `cancelable` as the browser decides. */
  go(delta: number, cancelable: boolean) {
    return this.#fire(
      this.entries[this.index + delta]!.url,
      "traverse",
      undefined,
      cancelable,
      delta,
    );
  }

  traverseTo(key: string, options: { info?: unknown } = {}) {
    const to = this.entries.findIndex((entry) => entry.key === key);
    return this.#fire(this.entries[to]!.url, "traverse", options.info, true, to - this.index);
  }

  #key(): string {
    return `k${this.#keys++}`;
  }

  #fire(url: string, navigationType: string, info: unknown, cancelable: boolean, delta = 0) {
    const handlers: (() => Promise<void>)[] = [];
    const event = Object.assign(new Event("navigate", { cancelable }), {
      canIntercept: new URL(url).origin === location.origin,
      hashChange: false,
      downloadRequest: null,
      formData: null,
      navigationType,
      destination: { url },
      info,
      intercept: (options: { handler: () => Promise<void> }) => handlers.push(options.handler),
    });
    if (!this.dispatchEvent(event)) {
      return { finished: Promise.reject(new DOMException("Cancelled", "AbortError")) };
    }
    if (handlers.length === 0) {
      this.documents.push(url);
      return { finished: new Promise<void>(() => {}) };
    }
    // Commit: the URL changes first, then the handlers run.
    if (navigationType === "traverse") this.index += delta;
    else if (navigationType === "push") {
      this.entries.splice(++this.index, Infinity, { key: this.#key(), url });
    } else this.entries[this.index] = { key: this.#key(), url };
    history.replaceState(null, "", url);
    this.#abort?.(new DOMException("Superseded", "AbortError"));
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    finished.catch(() => {});
    this.#abort = reject;
    const transition = (this.transition = { finished });
    Promise.all(handlers.map((handler) => handler())).then(() => {
      if (this.transition === transition) this.transition = null;
      resolve();
    }, reject);
    return { finished };
  }
}

describe("router hooks with the Navigation API", () => {
  let api: FakeNavigation;
  async function bootApi(at: string): Promise<void> {
    history.replaceState(null, "", at);
    api = new FakeNavigation();
    vi.stubGlobal("navigation", api);
    await boot(at);
    log = [];
    seen = [];
  }

  it("runs both hooks around link clicks and navigate(), and cancels them", async () => {
    await bootApi("/");
    await api.click("/users/2").finished;
    await settled();
    expect(text()).toBe("user 2");
    await navigate("/search?q=a");
    await settled();
    expect(log).toEqual([
      "before link / -> /users/2",
      "after link / -> /users/2",
      "before navigate /users/2 -> /search?q=a",
      "after navigate /users/2 -> /search?q=a",
    ]);
    log = [];
    cancel = () => true;
    await navigate("/");
    await searchParams.set({ q: "b" });
    expect(path(new URL(location.href))).toBe("/search?q=a");
    expect(text()).toBe("q=a");
    expect(log).toEqual([
      "before navigate /search?q=a -> /",
      "before navigate /search?q=a -> /search?q=b",
    ]);
  });

  it("cancels back/forward, and returns where the browser cannot cancel it", async () => {
    await bootApi("/");
    await navigate("/users/1");
    await navigate("/users/2");
    await settled();
    log = [];
    cancel = (n) => n.type === "popstate";
    await expect(api.go(-1, true).finished).rejects.toThrow();
    expect(location.pathname).toBe("/users/2");
    api.go(-1, false);
    await settled();
    await settled();
    expect(location.pathname).toBe("/users/2");
    expect(api.index).toBe(2);
    expect(text()).toBe("user 2");
    // The way back runs no hooks.
    expect(log).toEqual([
      "before popstate /users/2 -> /users/1",
      "before popstate /users/2 -> /users/1",
    ]);
    cancel = () => false;
    await api.go(-1, true).finished;
    await settled();
    expect(text()).toBe("user 1");
    expect(log.slice(2)).toEqual([
      "before popstate /users/2 -> /users/1",
      "after popstate /users/2 -> /users/1",
    ]);
  });

  it("runs only the newest navigation's afterNavigate when one supersedes another", async () => {
    await bootApi("/");
    api.click("/users/1");
    await navigate("/about");
    await settled();
    expect(text()).toBe("about");
    expect(log.filter((entry) => entry.startsWith("after"))).toEqual([
      "after navigate / -> /about",
    ]);
  });

  it("runs the hooks of document navigations with willUnload, then beforeunload asks if one cancelled", async () => {
    await bootApi("/");
    cancel = () => true;
    await navigate("/static");
    expect(api.documents).toEqual([`${location.origin}/static`]);
    expect(log).toEqual(["before navigate / -> /static (unload)"]);
    expect(unload()).toBe(true);
    expect(log).toHaveLength(1);
  });
});

describe("router hooks outside an SPA (an island on an MPA page)", () => {
  it("sees leave only, and fires afterNavigate once with enter", async () => {
    history.replaceState(null, "", "/blog?page=2");
    container = document.createElement("div");
    document.body.append(container);
    dispose = render(() => createComponent(Root, {}), container);
    await settled();
    expect(log).toEqual(["after enter null -> /blog?page=2"]);
    expect(seen[0]!.to).toEqual({
      url: new URL(`${location.origin}/blog?page=2`),
      route: undefined,
      params: {},
    });
    expect(unload()).toBe(false);
    cancel = () => true;
    expect(unload()).toBe(true);
    expect(log.slice(1)).toEqual([
      "before leave /blog?page=2 -> null (unload)",
      "before leave /blog?page=2 -> null (unload)",
    ]);
    // Disposed: the beforeunload listener goes too.
    dispose!();
    dispose = undefined;
    expect(unload()).toBe(false);
    expect(log).toHaveLength(3);
  });

  it("must be called during component setup (dev)", () => {
    expect(() => beforeNavigate(() => {})).toThrow(/during component setup/);
  });
});
