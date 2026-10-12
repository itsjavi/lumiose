// @vitest-environment happy-dom
// The client router (spec §7.5) on the History API fallback (happy-dom has no Navigation API).
// Components are written in their compiled shape; the SPA boots client-rendered (`ssr = false`),
// as `startSpa()` does through the island loader.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Component, Renderable } from "../../contract/client.ts";
import { isBusy, effect, onCleanup, signal } from "../../core/index.ts";
import {
  $async,
  $await,
  $leave,
  createComponent,
  insert,
  render,
  template,
} from "../../dom/index.ts";
import { Head } from "../../dom/head.ts";
import { Suspense } from "../../dom/boundaries.ts";
import { resetStates } from "../../core/state.ts";
import { invalidate as appInvalidate } from "../actions/client.ts";
import { query } from "../cache/client.ts";
import { notFound, redirect } from "../server/control.ts";
import { href } from "../routes/href.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { Link, navigate, isNavigating, locale, params, route, searchParams, url } from "./index.ts";
import { followLocaleLinks } from "./locale-links.ts";
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
  "src/routes/layout.tsx": Root,
  "src/routes/page.tsx": Home,
  "src/routes/users/layout.tsx": Users,
  "src/routes/users/[id]/page.tsx": User,
  "src/routes/books/[id]/page.tsx": Book,
  "src/routes/search/page.tsx": Search,
  "src/routes/old/page.tsx": Old,
  "src/routes/slow/page.tsx": SuspensePage,
  "src/routes/not-found.tsx": NotFound,
  "src/routes/error.tsx": ErrorPage,
};

const APP = "src/routes/layout.tsx";
const userLevels = [APP, "src/routes/users/layout.tsx", "src/routes/users/[id]/page.tsx"];

function config(base = "/"): SpaConfig {
  return {
    base,
    routes: [
      { segments: [], app: APP, levels: [APP, "src/routes/page.tsx"] },
      { segments: [s("search")], app: APP, levels: [APP, "src/routes/search/page.tsx"] },
      { segments: [s("old")], app: APP, levels: [APP, "src/routes/old/page.tsx"] },
      { segments: [s("slow")], app: APP, levels: [APP, "src/routes/slow/page.tsx"] },
      { segments: [s("static")] },
      {
        segments: [s("books"), param("id")],
        app: APP,
        levels: [APP, "src/routes/books/[id]/page.tsx"],
      },
      {
        segments: [s("users"), param("id")],
        app: APP,
        levels: userLevels,
        notFound: "src/routes/not-found.tsx",
        error: "src/routes/error.tsx",
      },
    ],
    notFoundPages: [{ file: "src/routes/not-found.tsx", dir: "", segments: [] }],
    pages: {
      "src/routes/not-found.tsx": { app: APP, levels: [APP, "src/routes/not-found.tsx"] },
      "src/routes/error.tsx": { app: APP, levels: [APP, "src/routes/error.tsx"] },
    },
    modules: Object.fromEntries(
      Object.entries(modules).map(([file, component]) => [
        file,
        () => Promise.resolve({ default: component }),
      ]),
    ),
  };
}

/** The app with locales: the search page in English only (decision-44). */
const localized = (): SpaConfig => {
  const base = config();
  return {
    ...base,
    i18n: { locales: ["en", "es"], defaultLocale: "en" },
    followLocaleLinks,
    routes: base.routes.map((each) =>
      each.levels === undefined
        ? each
        : {
            ...each,
            locales:
              each.segments[0]?.kind === "static" && each.segments[0].value === "search"
                ? ["en"]
                : ["en", "es"],
          },
    ),
  };
};

/** A page with its own canonical (`<Head>`), which replaces the router's (TASK-263). */
const About: Component<object> = () =>
  createComponent(Head, {
    get children() {
      return template('<link rel="canonical" href="https://example.com/about">')();
    },
  });

/** The hreflang and canonical links in `<head>`, as `rel hreflang href`. */
const localeLinks = (): string[] =>
  Array.from(
    document.head.querySelectorAll<HTMLLinkElement>("link[hreflang],link[rel=canonical]"),
    (link) => `${link.rel} ${link.hreflang} ${link.getAttribute("href")}`,
  );

let container: HTMLElement;
let dispose: (() => void) | undefined;

async function boot(path: string, leaf = "src/routes/page.tsx", base?: string): Promise<void> {
  history.replaceState(null, "", path);
  createRouter(config(base), APP);
  const RootComponent = await prepareRoot(leaf, true);
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => createComponent(RootComponent, {}), container);
  await settled();
}

const text = (): string => container.textContent ?? "";
/** The document a `_404`'s script hid for the router (TASK-231) is shown again. */
const hidden = (): boolean => document.documentElement.hasAttribute("data-l-reroute");

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
    await boot("/search?q=a", "src/routes/search/page.tsx");
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

  it("renders the page of a hydrating _404 whose URL is a page that reroutes (TASK-231)", async () => {
    // The server rendered the _404 (404.html on a static host) for /users/…, a prerendered page
    // with params; its script hid the document.
    const rerouting = config();
    rerouting.routes.find((r) =>
      r.levels?.includes("src/routes/users/[id]/page.tsx"),
    )!.reroute = true;
    const start = async (path: string): Promise<Component<object> & { $$fresh?: true }> => {
      history.replaceState(null, "", path);
      document.documentElement.setAttribute("data-l-reroute", "");
      document.documentElement.style.visibility = "hidden";
      createRouter(rerouting, APP);
      const root = await prepareRoot("src/routes/not-found.tsx", false);
      container = document.createElement("div");
      document.body.append(container);
      dispose = render(
        () => createComponent(root, { status: 404, message: "Not Found" }),
        container,
      );
      return root;
    };

    const root = await start("/users/1");
    // The island renders on the client instead of claiming the server's 404.
    expect(root.$$fresh).toBe(true);
    expect(hidden()).toBe(true);
    await settled();
    expect(text()).toBe("path /users/1users of 1user 1");
    expect(route()).toBe("/users/[id]");
    expect(hidden()).toBe(false);
    expect(document.documentElement.style.visibility).toBe("");
    dispose!();
    container.remove();
    resetRouter();

    // The page decides with the browser's data: still not found.
    userData["9"] = "missing";
    await start("/users/9");
    await settled();
    await settled();
    expect(text()).toBe("path /users/9404 Not Found");
    expect(hidden()).toBe(false);
    dispose!();
    container.remove();
    resetRouter();

    // A URL that matches no page keeps the server's 404.
    const unmatched = await start("/nowhere");
    expect(unmatched.$$fresh).toBeUndefined();
    await settled();
    expect(text()).toBe("path /nowhere404 Not Found");
    expect(hidden()).toBe(false);
  });

  it("keeps the 404 of a page that renders per request", async () => {
    history.replaceState(null, "", "/users/1");
    createRouter(config(), APP);
    const root = await prepareRoot("src/routes/not-found.tsx", false);
    container = document.createElement("div");
    document.body.append(container);
    dispose = render(() => createComponent(root, { status: 404, message: "Not Found" }), container);
    await settled();
    expect(text()).toBe("path /users/1404 Not Found");
    expect(loads).toEqual([]);
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
    await boot("/old", "src/routes/old/page.tsx");
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
    vi.stubGlobal("__LUMIOSE_TRAILING_SLASH__", "always");
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
      vi.unstubAllGlobals();
    }
  });

  it("routes locale-prefixed URLs of the locales a page declares (decision-44)", async () => {
    history.replaceState(null, "", "/es/users/1");
    createRouter(localized(), APP);
    const RootComponent = await prepareRoot("src/routes/page.tsx", true);
    container = document.createElement("div");
    document.body.append(container);
    dispose = render(() => createComponent(RootComponent, {}), container);
    await settled();
    expect(text()).toBe("path /es/users/1users of 1user 1");
    expect(locale()).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    // Another locale renders every level again.
    await navigate("/users/2");
    expect(text()).toBe("path /users/2users of 2user 2");
    expect(locale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(rootMounts).toBe(2);
    // A page the locale does not declare is the server's to answer.
    const assign = vi.fn();
    vi.stubGlobal("location", {
      ...location,
      href: location.href,
      origin: location.origin,
      assign,
    });
    try {
      await navigate("/es/search");
      expect(assign).toHaveBeenCalledWith(`${location.origin}/es/search`);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("updates the hreflang alternates and the canonical after navigations (TASK-263)", async () => {
    const o = location.origin;
    // The server's links for /es/users/1 (prerendered with `site`, another origin), plus links
    // that are not the router's: another kind of alternate and an x-default.
    document.head.innerHTML =
      '<link rel="canonical" href="https://example.com/es/users/1">' +
      '<link rel="alternate" type="application/rss+xml" href="/feed.xml">' +
      '<link rel="alternate" hreflang="en" href="https://example.com/users/1">' +
      '<link rel="alternate" hreflang="es" href="https://example.com/es/users/1">' +
      '<link rel="alternate" hreflang="x-default" href="/">';
    const server = document.head.innerHTML;
    const app = localized();
    app.routes.push({
      segments: [s("about")],
      app: APP,
      levels: [APP, "src/routes/about/page.tsx"],
      locales: ["en", "es"],
    });
    app.modules["src/routes/about/page.tsx"] = () => Promise.resolve({ default: About });
    history.replaceState(null, "", "/es/users/1");
    createRouter(app, APP);
    const RootComponent = await prepareRoot("src/routes/users/[id]/page.tsx", true);
    container = document.createElement("div");
    document.body.append(container);
    try {
      dispose = render(() => createComponent(RootComponent, {}), container);
      await settled();
      expect(document.head.innerHTML).toBe(server);
      await navigate("/users/2");
      expect(localeLinks()).toEqual([
        "alternate x-default /",
        `alternate en ${o}/users/2`,
        `alternate es ${o}/es/users/2`,
        `canonical  ${o}/users/2`,
      ]);
      expect(document.head.querySelector("[type]")).not.toBeNull();
      // English only: no alternates, no canonical.
      await navigate("/search");
      expect(localeLinks()).toEqual(["alternate x-default /"]);
      await navigate("/es/about");
      expect(localeLinks()).toEqual([
        "alternate x-default /",
        "canonical  https://example.com/about",
        `alternate en ${o}/about`,
        `alternate es ${o}/es/about`,
      ]);
      await navigate("/es/users/3");
      expect(localeLinks()).toEqual([
        "alternate x-default /",
        `alternate en ${o}/users/3`,
        `alternate es ${o}/es/users/3`,
        `canonical  ${o}/es/users/3`,
      ]);
    } finally {
      document.head.textContent = "";
    }
  });

  it("writes the first view's locale links when the server rendered another page (TASK-263)", async () => {
    // A `not-found` page the router reroutes: the server wrote none of the page's links.
    history.replaceState(null, "", "/es/users/1");
    createRouter(localized(), APP);
    const RootComponent = await prepareRoot("src/routes/page.tsx", true);
    container = document.createElement("div");
    document.body.append(container);
    try {
      dispose = render(() => createComponent(RootComponent, {}), container);
      await settled();
      const o = location.origin;
      expect(localeLinks()).toEqual([
        `alternate en ${o}/users/1`,
        `alternate es ${o}/es/users/1`,
        `canonical  ${o}/es/users/1`,
      ]);
    } finally {
      document.head.textContent = "";
    }
  });

  it("invalidate() re-runs the async components and keeps their UI meanwhile", async () => {
    await boot("/users/1", "src/routes/users/[id]/page.tsx");
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
    await boot("/books/1", "src/routes/books/[id]/page.tsx");
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
    withLoad.modules["src/routes/search/page.tsx"] = load;
    createRouter(withLoad, APP);
    const RootComponent = await prepareRoot("src/routes/page.tsx", true);
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
