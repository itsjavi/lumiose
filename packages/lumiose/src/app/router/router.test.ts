// @vitest-environment happy-dom
// The client router (spec §7.5) on the History API fallback (happy-dom has no Navigation API).
// Components are written in their compiled shape; the SPA boots client-rendered (`ssr = false`),
// as `startSpa()` does through the island loader.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { isBusy, effect, onCleanup, signal } from "../../core/index.ts";
import { $async, $await, $leave, createComponent, insert, render } from "../../dom/index.ts";
import { Suspense } from "../../dom/boundaries.ts";
import { resetStates } from "../../core/state.ts";
import { invalidate as appInvalidate } from "../actions/client.ts";
import { query } from "../cache/client.ts";
import { notFound, redirect } from "../server/control.ts";
import { href } from "../routes/href.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { Link, navigate, isNavigating, params, route, searchParams, url } from "./index.ts";
import { createRouter, invalidate, prepareRoot, resetRouter, type SpaConfig } from "./router.ts";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const s = (value: string): RouteSegment => ({ kind: "static", value });
const param = (name: string): RouteSegment => ({ kind: "param", name });

function el(tag: string, text?: () => string): HTMLElement {
  const node = document.createElement(tag);
  if (text !== undefined) insert(node, text);
  return node;
}

let rootMounts = 0;
let usersMounts = 0;
const loads: string[] = [];
let userData: Record<string, Deferred<string> | string> = {};

const Root: Component<{ children?: Renderable }> = (props) => {
  rootMounts++;
  const main = el("div");
  main.id = "root";
  main.append(el("p", () => `path ${url().pathname}`));
  insert(main, () => props.children);
  return main;
};

const Users: Component<{ params: Record<string, string>; children?: Renderable }> = (props) => {
  usersMounts++;
  const section = el("section");
  section.append(el("p", () => `users of ${props.params.id}`));
  insert(section, () => props.children);
  return section;
};

const Home: Component<object> = () => el("h1", () => "home");

const User = $async(async function User(props: { params: { id: string } }) {
  try {
    const id = props.params.id;
    loads.push(id);
    const data = userData[id] ?? `user ${id}`;
    const name = (await $await(() => (typeof data === "string" ? data : data.promise), 0))();
    if (name === "missing") notFound();
    if (name === "moved") redirect("/users/2");
    if (name === "broken") throw new Error("boom");
    return el("h1", () => name);
  } finally {
    $leave();
  }
});

// A page cached by `query()` (TASK-195): `bookData` answers its loads.
const bookLoads: string[] = [];
let bookData: Record<string, Deferred<string> | string> = {};
const Book = $async(async function Book(props: { params: { id: string } }) {
  try {
    const id = props.params.id;
    const load = () => {
      bookLoads.push(id);
      const data = bookData[id] ?? `book ${id}`;
      return typeof data === "string" ? data : data.promise;
    };
    const name = (await $await(() => query(["book", id], load), 0))();
    return el("h1", () => name);
  } finally {
    $leave();
  }
});

const Search: Component<object> = () => el("p", () => `q=${searchParams().get("q") ?? ""}`);

const Old: Component<object> = () => redirect("/search?q=moved");

const Slow = $async(async function Slow() {
  try {
    (await $await(() => new Promise<void>((resolve) => setTimeout(resolve, 5)), 0))();
    return el("p", () => "slow done");
  } finally {
    $leave();
  }
});

const SuspensePage: Component<object> = () =>
  createComponent(Suspense, {
    get fallback() {
      return el("p", () => "fallback");
    },
    get children() {
      return createComponent(Slow, {});
    },
  });

const NotFound: Component<{ status: number; error: Error }> = (props) =>
  el("h1", () => `${props.status} ${props.error.message}`);

const ErrorPage: Component<{ status: number; error: Error }> = (props) =>
  el("h1", () => `error ${props.status}: ${props.error.message}`);

const modules: Record<string, Component<any>> = {
  "src/routes/_layout.tsx": Root,
  "src/routes/index.tsx": Home,
  "src/routes/users/_layout.tsx": Users,
  "src/routes/users/[id].tsx": User,
  "src/routes/books/[id].tsx": Book,
  "src/routes/search.tsx": Search,
  "src/routes/old.tsx": Old,
  "src/routes/slow.tsx": SuspensePage,
  "src/routes/_404.tsx": NotFound,
  "src/routes/_error.tsx": ErrorPage,
};

const APP = "src/routes/_layout.tsx";
const userLevels = [APP, "src/routes/users/_layout.tsx", "src/routes/users/[id].tsx"];

function config(base = "/"): SpaConfig {
  return {
    base,
    routes: [
      { segments: [], app: APP, levels: [APP, "src/routes/index.tsx"] },
      { segments: [s("search")], app: APP, levels: [APP, "src/routes/search.tsx"] },
      { segments: [s("old")], app: APP, levels: [APP, "src/routes/old.tsx"] },
      { segments: [s("slow")], app: APP, levels: [APP, "src/routes/slow.tsx"] },
      { segments: [s("static")] },
      { segments: [s("books"), param("id")], app: APP, levels: [APP, "src/routes/books/[id].tsx"] },
      {
        segments: [s("users"), param("id")],
        app: APP,
        levels: userLevels,
        notFound: "src/routes/_404.tsx",
        error: "src/routes/_error.tsx",
      },
    ],
    notFoundPages: [{ file: "src/routes/_404.tsx", dir: "", segments: [] }],
    pages: {
      "src/routes/_404.tsx": { app: APP, levels: [APP, "src/routes/_404.tsx"] },
      "src/routes/_error.tsx": { app: APP, levels: [APP, "src/routes/_error.tsx"] },
    },
    modules: Object.fromEntries(
      Object.entries(modules).map(([file, component]) => [
        file,
        () => Promise.resolve({ default: component }),
      ]),
    ),
  };
}

let container: HTMLElement;
let dispose: (() => void) | undefined;

async function boot(path: string, leaf = "src/routes/index.tsx", base?: string): Promise<void> {
  history.replaceState(null, "", path);
  createRouter(config(base), APP);
  const RootComponent = await prepareRoot(leaf, true);
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => createComponent(RootComponent, {}), container);
  await settled();
}

const text = (): string => container.textContent ?? "";

beforeEach(() => {
  rootMounts = usersMounts = 0;
  loads.length = 0;
  userData = {};
  bookLoads.length = 0;
  bookData = {};
  resetStates();
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  container?.remove();
  resetRouter();
});

describe("lumiose/router", () => {
  it("renders the URL's route inside its layouts", async () => {
    await boot("/users/1");
    expect(text()).toBe("path /users/1users of 1user 1");
    expect(params()).toEqual({ id: "1" });
    expect(url().pathname).toBe("/users/1");
    expect(route()).toBe("/users/[id]");
  });

  it("keeps the layouts both pages share mounted", async () => {
    await boot("/users/1");
    const section = container.querySelector("section");
    await navigate("/users/2");
    expect(text()).toBe("path /users/2users of 2user 2");
    expect(container.querySelector("section")).toBe(section);
    expect([rootMounts, usersMounts]).toEqual([1, 1]);
    await navigate("/");
    expect(text()).toBe("path /home");
    expect(container.querySelector("section")).toBeNull();
    expect(rootMounts).toBe(1);
    expect(location.pathname).toBe("/");
  });

  it("holds the old page until the new page's async content is ready", async () => {
    await boot("/");
    const user = (userData["3"] = deferred<string>());
    const done = navigate("/users/3");
    await settled();
    expect(isNavigating()).toBe(true);
    expect(isBusy()).toBe(true);
    // The URL changed, the page and the URL signals did not.
    expect(location.pathname).toBe("/users/3");
    expect(text()).toBe("path /home");
    user.resolve("slow user");
    await done;
    expect(text()).toBe("path /users/3users of 3slow user");
    expect(isNavigating()).toBe(false);
  });

  it("drops a navigation that another one supersedes", async () => {
    await boot("/");
    const first = (userData["3"] = deferred<string>());
    const superseded = navigate("/users/3");
    await settled();
    await navigate("/search?q=x");
    await superseded;
    expect(text()).toBe("path /searchq=x");
    first.resolve("late");
    await settled();
    expect(text()).toBe("path /searchq=x");
  });

  it("commits a navigation that keeps every level at once", async () => {
    await boot("/search?q=a", "src/routes/search.tsx");
    expect(text()).toBe("path /searchq=a");
    await searchParams.set({ q: "b", empty: null });
    expect(location.search).toBe("?q=b");
    expect(text()).toBe("path /searchq=b");
    expect(searchParams().get("q")).toBe("b");
  });

  it("shows a page's own <Suspense> fallback instead of holding the old page", async () => {
    await boot("/");
    await navigate("/slow");
    expect(text()).toBe("path /slowfallback");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(text()).toBe("path /slowslow done");
  });

  it("renders _404 for unknown URLs and notFound(), _error for errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await boot("/");
    await navigate("/nowhere");
    expect(text()).toBe("path /nowhere404 Not Found");
    expect(route()).toBeUndefined();
    userData["9"] = "missing";
    await navigate("/users/9");
    await settled();
    expect(text()).toBe("path /users/9404 Not Found");
    // notFound() in a matched route keeps its pattern, as on the server.
    expect(route()).toBe("/users/[id]");
    userData["8"] = "broken";
    await navigate("/users/8");
    await settled();
    expect(text()).toBe("path /users/8error 500: boom");
    expect(error).toHaveBeenCalledOnce();
    expect(rootMounts).toBe(1);
    error.mockRestore();
  });

  it("follows a thrown redirect()", async () => {
    await boot("/");
    userData["7"] = "moved";
    await navigate("/users/7");
    await settled();
    await settled();
    expect(location.pathname).toBe("/users/2");
    expect(text()).toBe("path /users/2users of 2user 2");
  });

  it("follows a redirect() thrown while the first page renders", async () => {
    await boot("/old", "src/routes/old.tsx");
    await settled();
    expect(location.pathname + location.search).toBe("/search?q=moved");
    expect(text()).toBe("path /searchq=moved");
    expect(rootMounts).toBe(1);
  });

  it("navigates to URLs it does not own with a document navigation", async () => {
    await boot("/");
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...location,
      href: location.href,
      origin: location.origin,
      assign,
    });
    try {
      await navigate("/static");
      expect(assign).toHaveBeenCalledWith(`${location.origin}/static`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("routes link clicks and back/forward", async () => {
    await boot("/");
    const link = document.createElement("a");
    link.href = "/users/1";
    container.append(link);
    link.click();
    await settled();
    expect(text()).toBe("path /users/1users of 1user 1");
    history.back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(location.pathname).toBe("/");
    expect(text()).toBe("path /home");
  });

  it("routes href() links below the base, with trailing slashes (TASK-101)", async () => {
    vi.stubEnv("BASE_URL", "/sub/");
    vi.stubEnv("LUMIOSE_TRAILING_SLASH", "always");
    try {
      await boot("/sub/", undefined, "/sub/");
      expect(text()).toBe("path /sub/home");
      await navigate(href("/users/[id]", { id: "7" }));
      expect(location.pathname).toBe("/sub/users/7/");
      expect(text()).toBe("path /sub/users/7/users of 7user 7");
      await navigate(href("/"));
      expect(text()).toBe("path /sub/home");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("invalidate() re-runs the async components and keeps their UI meanwhile", async () => {
    await boot("/users/1", "src/routes/users/[id].tsx");
    expect(loads).toEqual(["1"]);
    const again = (userData["1"] = deferred<string>());
    const done = invalidate();
    await settled();
    expect(loads).toEqual(["1", "1"]);
    expect(text()).toBe("path /users/1users of 1user 1");
    again.resolve("user 1 again");
    await done;
    expect(text()).toBe("path /users/1users of 1user 1 again");
    // `invalidate()` from `lumiose` (form actions) goes through the router.
    userData["1"] = "third";
    await appInvalidate();
    expect(text()).toBe("path /users/1users of 1third");
  });

  it("keeps cached entries across navigations: going back shows them at once (TASK-195)", async () => {
    await boot("/books/1", "src/routes/books/[id].tsx");
    expect(text()).toBe("path /books/1book 1");
    await navigate("/");
    expect(text()).toBe("path /home");
    await settled();
    // Back: the page commits with the cached data while its refetch is still in flight.
    const refetch = (bookData["1"] = deferred<string>());
    await navigate("/books/1");
    expect(text()).toBe("path /books/1book 1");
    expect(bookLoads).toEqual(["1", "1"]);
    refetch.resolve("book 1, 2nd edition");
    await settled();
    expect(text()).toBe("path /books/1book 1, 2nd edition");
    // A page never visited still waits for its data.
    const other = (bookData["2"] = deferred<string>());
    const going = navigate("/books/2");
    await settled();
    expect(text()).toBe("path /books/1book 1, 2nd edition");
    other.resolve("book 2");
    await going;
    expect(text()).toBe("path /books/2book 2");
  });

  it("<Link> marks the current page and prefetches its route", async () => {
    await boot("/");
    const load = vi.fn(() => Promise.resolve({ default: Search }));
    // A fresh router whose search module counts its loads.
    resetRouter();
    dispose?.();
    history.replaceState(null, "", "/");
    const withLoad = config();
    withLoad.modules["src/routes/search.tsx"] = load;
    createRouter(withLoad, APP);
    const RootComponent = await prepareRoot("src/routes/index.tsx", true);
    let link!: HTMLAnchorElement;
    dispose = render(() => {
      const root = createComponent(RootComponent, {});
      link = createComponent(Link, {
        href: "/search?q=1",
        get children() {
          return "Search";
        },
      }) as HTMLAnchorElement;
      return [root, link];
    }, container);
    expect(link.outerHTML).toBe('<a href="/search?q=1">Search<!----></a>');
    link.dispatchEvent(new Event("pointerenter"));
    expect(load).toHaveBeenCalledOnce();
    // happy-dom has no Navigation API: the History fallback starts listening once it loads.
    await settled();
    link.click();
    await settled();
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(load).toHaveBeenCalledOnce();
  });

  it("gives content created for a pending page that page's params", async () => {
    await boot("/users/1");
    const seen: string[] = [];
    const stop = effect(() => {
      seen.push(params().id ?? "");
    });
    onCleanup(stop);
    await settled();
    await navigate("/users/2");
    await settled();
    expect(seen).toEqual(["1", "2"]);
    stop();
  });

  it("refuses to navigate to a javascript: URL (TASK-166)", async () => {
    await boot("/");
    expect(() => navigate("javascript:alert(1)")).toThrow(TypeError);
    expect(location.pathname).toBe("/");
  });

  it("reads url() and params() outside the router as errors", () => {
    expect(() => params()).toThrow(/inside spa routes/);
    expect(() => route()).toThrow(/inside spa routes/);
    expect(isNavigating()).toBe(false);
    const count = signal(0);
    expect(count()).toBe(0);
  });
});
